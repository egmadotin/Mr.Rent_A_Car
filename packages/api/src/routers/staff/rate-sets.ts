import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Settings > Rates > Rate Sets (client request, Nov 17): a season's rates are a set of rate codes, one per rental-length
 * band — "INT Fall End 1 to 2 Days", "… 3 to 5 Days" … "… 26 to 30 Days" — each covering every vehicle class. A set is
 * the codes at one location whose names are "<set name> <from> to <to> Days". This edits a set as one grid (vehicle
 * class × band) per season and price field, and creates a new season's set (7 codes) in one go.
 */
const BAND_RE = /^(.*?)\s*(\d+)\s*to\s*(\d+)\s*Days?$/i;
export const DEFAULT_BANDS: [number, number][] = [[1, 2], [3, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, 30]];

const FIELDS = ["hourly", "daily", "extraDaily", "weekly", "monthly", "kmAllowed", "kmWeekly", "kmMonthly"] as const;
type Field = (typeof FIELDS)[number];
const isKm = (f: Field) => f.startsWith("km");

const parseBand = (code: string) => {
  const m = code.trim().match(BAND_RE);
  return m ? { set: m[1]!.trim(), from: Number(m[2]), to: Number(m[3]) } : null;
};

async function setRates(db: Prisma.TransactionClient, locationId: string, set: string) {
  const rates = await db.rate.findMany({
    where: { locationId, code: { startsWith: set, mode: "insensitive" } },
    include: { seasons: { include: { season: { select: { id: true, name: true, startDate: true } } } } },
  });
  return rates
    .map((r) => ({ r, b: parseBand(r.code) }))
    .filter((x): x is { r: (typeof rates)[number]; b: NonNullable<ReturnType<typeof parseBand>> } => !!x.b && x.b.set.toLowerCase() === set.toLowerCase())
    .sort((a, b) => a.b.from - b.b.from);
}

export const rateSetsRouter = router({
  /** The sets at a location (and, for each, its bands and seasons). */
  list: staffProcedure.input(z.object({ locationId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const rates = await ctx.prisma.rate.findMany({
      where: { locationId: input.locationId },
      select: { id: true, code: true, isActive: true, displayOnline: true, seasons: { select: { season: { select: { id: true, name: true, startDate: true } } } } },
    });
    const sets = new Map<string, { name: string; bands: { rateId: string; code: string; from: number; to: number; isActive: boolean }[]; seasons: Map<string, { id: string; name: string; start: Date }> }>();
    for (const r of rates) {
      const b = parseBand(r.code);
      if (!b) continue;
      const key = b.set.toLowerCase();
      const s = sets.get(key) ?? { name: b.set, bands: [] as { rateId: string; code: string; from: number; to: number; isActive: boolean }[], seasons: new Map<string, { id: string; name: string; start: Date }>() };
      s.bands.push({ rateId: r.id, code: r.code, from: b.from, to: b.to, isActive: r.isActive });
      for (const { season } of r.seasons) s.seasons.set(season.id, { id: season.id, name: season.name, start: season.startDate });
      sets.set(key, s);
    }
    return [...sets.values()]
      .map((s) => ({
        name: s.name,
        bands: s.bands.sort((a, b) => a.from - b.from),
        seasons: [...s.seasons.values()].sort((a, b) => +a.start - +b.start).map(({ id, name }) => ({ id, name })),
        active: s.bands.some((b) => b.isActive),
      }))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }),

  /** One season of a set as a grid: every vehicle class × band, all price fields. */
  grid: staffProcedure
    .input(z.object({ locationId: z.string().min(1), set: z.string().min(1), seasonId: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const bands = await setRates(ctx.prisma, input.locationId, input.set);
      const values = await ctx.prisma.rateValue.findMany({ where: { rateId: { in: bands.map((x) => x.r.id) }, seasonId: input.seasonId } });
      const types = await ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
      const n = (d: Prisma.Decimal | number | null) => (d == null ? null : Number(d));
      return {
        bands: bands.map(({ r, b }) => ({ rateId: r.id, code: r.code, from: b.from, to: b.to, isActive: r.isActive, displayOnline: r.displayOnline })),
        types,
        cells: values.map((v) => ({
          rateId: v.rateId,
          vehicleTypeId: v.vehicleTypeId,
          hourly: n(v.hourly), daily: n(v.daily), extraDaily: n(v.extraDaily), weekly: n(v.weekly), monthly: n(v.monthly),
          kmAllowed: v.kmAllowed, kmWeekly: v.kmWeekly, kmMonthly: v.kmMonthly,
        })),
      };
    }),

  /** Save the edited cells of one price field (blank = no price: the class isn't offered on that band). */
  save: permitted("RatesEdit")
    .input(
      z.object({
        seasonId: z.string().nullable(),
        field: z.enum(FIELDS),
        cells: z.array(z.object({ rateId: z.string(), vehicleTypeId: z.string(), value: z.number().min(0).nullable() })).max(2000),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        let n = 0;
        for (const c of input.cells) {
          const v = c.value == null ? null : isKm(input.field) ? Math.round(c.value) : new Prisma.Decimal(c.value);
          const existing = await tx.rateValue.findFirst({ where: { rateId: c.rateId, vehicleTypeId: c.vehicleTypeId, seasonId: input.seasonId } });
          if (existing) await tx.rateValue.update({ where: { id: existing.id }, data: { [input.field]: v } });
          else if (v != null) await tx.rateValue.create({ data: { rateId: c.rateId, vehicleTypeId: c.vehicleTypeId, seasonId: input.seasonId, [input.field]: v } });
          else continue;
          n++;
        }
        await audit(tx, "RateSet", input.cells[0]?.rateId ?? "-", ctx.user.id, { Saved: [null, `${n} ${input.field} prices`] });
        return { saved: n };
      }),
    ),

  /**
   * New set: one rate code per band ("<name> 1 to 2 Days" …), for the chosen seasons, settings and (optionally) prices
   * copied from an existing set — any location — with a % change.
   */
  create: permitted("RatesAdd")
    .input(
      z.object({
        locationId: z.string().min(1),
        name: z.string().trim().min(2, "Name the set, e.g. INT Winter").max(60),
        seasonIds: z.array(z.string()).min(1, "Choose at least one season"),
        bands: z.array(z.tuple([z.number().int().min(0), z.number().int().min(1)])).min(1).max(12).default(DEFAULT_BANDS),
        copyFrom: z.object({ locationId: z.string(), set: z.string(), seasonId: z.string().nullable(), percent: z.number().min(-90).max(500).default(0) }).nullable().optional(),
        displayOnline: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        for (const [a, b] of input.bands) if (b < a) throw new TRPCError({ code: "BAD_REQUEST", message: `Band ${a}–${b} days ends before it starts.` });
        const codes = input.bands.map(([a, b]) => `${input.name} ${a} to ${b} Days`);
        const taken = await tx.rate.findMany({ where: { locationId: input.locationId, code: { in: codes } }, select: { code: true } });
        if (taken.length) throw new TRPCError({ code: "CONFLICT", message: `This location already has ${taken.map((t) => t.code).join(", ")}.` });
        const source = input.copyFrom ? await setRates(tx, input.copyFrom.locationId, input.copyFrom.set) : [];
        if (input.copyFrom && !source.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The set to copy from wasn't found." });
        const factor = 1 + (input.copyFrom?.percent ?? 0) / 100;
        const round2 = (d: Prisma.Decimal | null) => (d == null ? null : new Prisma.Decimal(d.mul(factor).toFixed(2)));
        const created: string[] = [];
        for (const [i, [a, b]] of input.bands.entries()) {
          // settings from the copied band with the same position (or the nearest), else this system's defaults
          const src = source[Math.min(i, source.length - 1)]?.r;
          const rate = await tx.rate.create({
            data: {
              code: codes[i]!,
              locationId: input.locationId,
              calculationBy: src?.calculationBy ?? "HOUR_24",
              rateType: "Min/Max+Regular",
              validFor: "SEASON",
              extraKmCharge: src?.extraKmCharge ?? new Prisma.Decimal(0),
              graceMinutes: src?.graceMinutes ?? 59,
              fuelChargePerUnit: src?.fuelChargePerUnit ?? new Prisma.Decimal(0),
              minChargeDays: src?.minChargeDays ?? 1,
              // RentCentric's convention: "1 to 2 Days" = min 1, max 3 (up to the start of the next band)
              minDays: a,
              maxDays: b + 1,
              availableDays: src?.availableDays ?? [true, true, true, true, true, true, true],
              skipHourly: src?.skipHourly ?? false,
              valuePricing: src?.valuePricing ?? false,
              displayOnline: input.displayOnline,
              seasons: { create: input.seasonIds.map((seasonId) => ({ seasonId })) },
            },
          });
          created.push(rate.id);
          if (src && input.copyFrom) {
            const vals = await tx.rateValue.findMany({ where: { rateId: src.id, seasonId: input.copyFrom.seasonId } });
            for (const seasonId of input.seasonIds)
              if (vals.length)
                await tx.rateValue.createMany({
                  data: vals.map((v) => ({
                    rateId: rate.id, vehicleTypeId: v.vehicleTypeId, seasonId,
                    hourly: round2(v.hourly), daily: round2(v.daily), extraDaily: round2(v.extraDaily), weekly: round2(v.weekly), monthly: round2(v.monthly),
                    kmAllowed: v.kmAllowed, kmHourly: v.kmHourly, kmWeekly: v.kmWeekly, kmMonthly: v.kmMonthly, extraKmCharge: v.extraKmCharge,
                  })),
                });
          }
        }
        await audit(tx, "RateSet", created[0]!, ctx.user.id, { Created: [null, `${input.name}: ${codes.length} codes`] });
        return { created: created.length, codes };
      }),
    ),
});
