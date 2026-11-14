import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";
import { seasonsAt } from "../../lib/pricing";
import { utilizationOn } from "../../lib/rate-rules";

const day = z.coerce.date();
const scope = z.object({ locationId: z.string().min(1), rateId: z.string().nullish(), vehicleTypeId: z.string().nullish(), startDate: day, endDate: day });
const checkDates = (s: { startDate: Date; endDate: Date }) => {
  if (+s.endDate < +s.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "The end date is before the start date." });
};
const DAY = 86_400_000;

/** Names for the lists (ids are stored plain so a rule survives a renamed rate). */
async function names(db: Prisma.TransactionClient) {
  const [locs, rates, types] = await Promise.all([
    db.location.findMany({ select: { id: true, name: true } }),
    db.rate.findMany({ select: { id: true, code: true } }),
    db.vehicleType.findMany({ select: { id: true, name: true } }),
  ]);
  const m = (xs: { id: string; name?: string; code?: string }[]) => new Map(xs.map((x) => [x.id, x.name ?? x.code ?? ""]));
  return { loc: m(locs), rate: m(rates), type: m(types) };
}

/**
 * Settings > Rates: Rate Blocking, Rate Values Update, Rate Utilization, Rates Calendar and Overbooking Control
 * (RentCentric RateBlocking / RateValuesUpdate2 / RateUtilization / RatesCalendar / CapacityControl). Changing them needs
 * the RatesEdit permission; anyone on staff can look.
 */
export const rateControlsRouter = router({
  // ── Rate Blocking (BLOCK) and Rate Values Update (ADJUST)
  rules: staffProcedure.input(z.object({ kind: z.enum(["BLOCK", "ADJUST"]) })).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.rateRule.findMany({ where: { kind: input.kind }, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
    const n = await names(ctx.prisma);
    return rows.map((r) => ({
      ...r,
      value: r.value?.toFixed(2) ?? null,
      location: n.loc.get(r.locationId) ?? "(deleted)",
      rate: r.rateId ? (n.rate.get(r.rateId) ?? "(deleted rate)") : "All rates",
      vehicleType: r.vehicleTypeId ? (n.type.get(r.vehicleTypeId) ?? "(deleted type)") : "All vehicle types",
    }));
  }),
  addRule: permitted("RatesEdit")
    .input(
      scope.extend({
        kind: z.enum(["BLOCK", "ADJUST"]),
        weekdays: z.array(z.boolean()).length(7),
        changeType: z.enum(["PERCENT", "FLAT", "TOTAL"]).nullish(),
        value: z.number().nullish(),
        note: z.string().trim().max(200).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      checkDates(input);
      if (!input.weekdays.some(Boolean)) throw new TRPCError({ code: "BAD_REQUEST", message: "Tick at least one weekday." });
      if (input.kind === "ADJUST" && (!input.changeType || input.value == null))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the change (percent, flat amount or total)." });
      const r = await ctx.prisma.rateRule.create({
        data: {
          kind: input.kind,
          locationId: input.locationId,
          rateId: input.rateId || null,
          vehicleTypeId: input.vehicleTypeId || null,
          startDate: input.startDate,
          endDate: input.endDate,
          weekdays: input.weekdays,
          changeType: input.kind === "ADJUST" ? input.changeType : null,
          value: input.kind === "ADJUST" ? input.value : null,
          note: input.note || null,
          createdById: ctx.user.id,
        },
      });
      await audit(ctx.prisma, "RateRule", r.id, ctx.user.id, { [input.kind === "BLOCK" ? "Blocked" : "Adjusted"]: [null, `${input.startDate.toISOString().slice(0, 10)}–${input.endDate.toISOString().slice(0, 10)}`] });
      return { id: r.id };
    }),
  removeRule: permitted("RatesEdit").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.rateRule.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "RateRule", input.id, ctx.user.id, { Removed: [null, "yes"] });
    return { ok: true };
  }),

  // ── Rate Utilization
  utilizations: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.rateUtilization.findMany({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
    const n = await names(ctx.prisma);
    return rows.map((r) => ({
      ...r,
      tiers: r.tiers.map((t) => Number(t)),
      location: n.loc.get(r.locationId) ?? "(deleted)",
      rate: r.rateId ? (n.rate.get(r.rateId) ?? "(deleted rate)") : "All rates",
      vehicleType: r.vehicleTypeId ? (n.type.get(r.vehicleTypeId) ?? "(deleted type)") : "All vehicle types",
    }));
  }),
  addUtilization: permitted("RatesEdit")
    .input(scope.extend({ tiers: z.array(z.number().min(-100).max(1000)).length(16) }))
    .mutation(async ({ ctx, input }) => {
      checkDates(input);
      if (input.tiers.every((t) => t === 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter at least one % change." });
      const r = await ctx.prisma.rateUtilization.create({
        data: { locationId: input.locationId, rateId: input.rateId || null, vehicleTypeId: input.vehicleTypeId || null, startDate: input.startDate, endDate: input.endDate, tiers: input.tiers, createdById: ctx.user.id },
      });
      await audit(ctx.prisma, "RateUtilization", r.id, ctx.user.id, { Added: [null, "yes"] });
      return { id: r.id };
    }),
  removeUtilization: permitted("RatesEdit").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.rateUtilization.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "RateUtilization", input.id, ctx.user.id, { Removed: [null, "yes"] });
    return { ok: true };
  }),
  /** Today's utilization of each vehicle type at a location (shown beside the tiers). */
  utilizationNow: staffProcedure.input(z.object({ locationId: z.string().min(1), on: day })).query(async ({ ctx, input }) => {
    const types = await ctx.prisma.vehicleType.findMany({ where: { vehicles: { some: { isActive: true, rentalLocationId: input.locationId } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const d = new Date(Date.UTC(input.on.getUTCFullYear(), input.on.getUTCMonth(), input.on.getUTCDate()));
    return Promise.all(types.map(async (t) => ({ ...t, ...(await utilizationOn(ctx.prisma, { locationId: input.locationId, vehicleTypeId: t.id, day: d })) })));
  }),

  // ── Overbooking Control
  overbookings: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.overbooking.findMany({ orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
    const n = await names(ctx.prisma);
    return rows.map((r) => ({ ...r, location: n.loc.get(r.locationId) ?? "(deleted)", vehicleType: n.type.get(r.vehicleTypeId) ?? "(deleted type)" }));
  }),
  addOverbooking: permitted("RatesEdit")
    .input(z.object({ locationIds: z.array(z.string()).min(1), vehicleTypeIds: z.array(z.string()).min(1), startDate: day, endDate: day, overbookBy: z.number().int().min(1).max(999), unit: z.enum(["UNIT", "PERCENT"]) }))
    .mutation(async ({ ctx, input }) => {
      checkDates(input);
      const data = input.locationIds.flatMap((locationId) =>
        input.vehicleTypeIds.map((vehicleTypeId) => ({ locationId, vehicleTypeId, startDate: input.startDate, endDate: input.endDate, overbookBy: input.overbookBy, unit: input.unit, createdById: ctx.user.id })),
      );
      await ctx.prisma.overbooking.createMany({ data });
      return { count: data.length };
    }),
  removeOverbooking: permitted("RatesEdit").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.overbooking.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  // ── Rates Calendar: daily price per vehicle type and day, master or adjusted (blocks / Rate Values Update / utilization)
  calendar: staffProcedure
    .input(z.object({ locationId: z.string().min(1), startDate: day, endDate: day, adjusted: z.boolean(), rateId: z.string().nullish() }))
    .query(async ({ ctx, input }) => {
      checkDates(input);
      const span = Math.round((+input.endDate - +input.startDate) / DAY) + 1;
      if (span > 62) throw new TRPCError({ code: "BAD_REQUEST", message: "Show at most 62 days at a time." });
      const days = Array.from({ length: span }, (_, i) => new Date(+input.startDate + i * DAY));
      const rates = await ctx.prisma.rate.findMany({
        where: { locationId: input.locationId, isActive: true, ...(input.rateId ? { id: input.rateId } : { displayOnline: true }) },
        include: { values: { include: { vehicleType: { select: { id: true, name: true } } } } },
        orderBy: { code: "asc" },
      });
      const rules = input.adjusted
        ? await ctx.prisma.rateRule.findMany({ where: { locationId: input.locationId, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }, orderBy: { createdAt: "asc" } })
        : [];
      const utils = input.adjusted
        ? await ctx.prisma.rateUtilization.findMany({ where: { locationId: input.locationId, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }, orderBy: { createdAt: "desc" } })
        : [];
      const seasonsByDay = await Promise.all(days.map((d) => seasonsAt(ctx.prisma, new Date(+d + 12 * 3600_000), "UTC")));
      const on = (r: { startDate: Date; endDate: Date; weekdays?: boolean[] }, d: Date) => +r.startDate <= +d && +d <= +r.endDate && (!r.weekdays || r.weekdays[d.getUTCDay()]);
      const fits = (r: { rateId: string | null; vehicleTypeId: string | null }, rateId: string, typeId: string) => (!r.rateId || r.rateId === rateId) && (!r.vehicleTypeId || r.vehicleTypeId === typeId);
      const utilCache = new Map<string, number>();

      const rows: { rate: string; vehicleType: string; cells: (string | null)[] }[] = [];
      for (const r of rates) {
        const typeIds = [...new Set(r.values.map((v) => v.vehicleTypeId))];
        for (const typeId of typeIds) {
          const cells: (string | null)[] = [];
          for (const [i, d] of days.entries()) {
            const inRange = r.validFor === "SEASON" || ((!r.effectiveDate || +r.effectiveDate <= +d) && (!r.endDate || +r.endDate >= +d));
            const v = r.values.find((x) => x.vehicleTypeId === typeId && x.seasonId && seasonsByDay[i]!.includes(x.seasonId)) ?? r.values.find((x) => x.vehicleTypeId === typeId && !x.seasonId);
            if (!inRange || !v?.daily) { cells.push(null); continue; }
            let price = v.daily;
            if (input.adjusted) {
              const here = rules.filter((x) => on(x, d) && fits(x, r.id, typeId));
              if (here.some((x) => x.kind === "BLOCK")) { cells.push("blocked"); continue; }
              const adj = here.filter((x) => x.kind === "ADJUST").at(-1);
              if (adj?.changeType && adj.value != null)
                price = adj.changeType === "PERCENT" ? price.mul(new Prisma.Decimal(100).add(adj.value)).div(100) : adj.changeType === "FLAT" ? price.add(adj.value) : adj.value;
              const u = utils.find((x) => on(x, d) && fits(x, r.id, typeId));
              if (u) {
                const key = `${typeId}|${+d}`;
                if (!utilCache.has(key)) utilCache.set(key, (await utilizationOn(ctx.prisma, { locationId: input.locationId, vehicleTypeId: typeId, day: d })).pct);
                const t = u.tiers[Math.min(15, Math.max(0, Math.floor(utilCache.get(key)! / 10)))];
                if (t && !t.isZero()) price = price.mul(new Prisma.Decimal(100).add(t)).div(100);
              }
            }
            cells.push(Prisma.Decimal.max(price, 0).toFixed(2));
          }
          if (cells.some((c) => c !== null)) rows.push({ rate: r.code, vehicleType: r.values.find((x) => x.vehicleTypeId === typeId)!.vehicleType.name, cells });
        }
      }
      rows.sort((a, b) => a.vehicleType.localeCompare(b.vehicleType) || a.rate.localeCompare(b.rate));
      return { days: days.map((d) => d.toISOString().slice(0, 10)), rows };
    }),
});
