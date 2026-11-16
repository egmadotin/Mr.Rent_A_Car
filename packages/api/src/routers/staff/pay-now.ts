import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";

const discountInput = z.object({
  locationId: z.string().min(1, "Choose the location"),
  rateId: z.string().min(1, "Rate is required"),
  vehicleTypeIds: z.array(z.string()),
  startsAt: z.coerce.date({ message: "Begin Date is required" }),
  endsAt: z.coerce.date({ message: "End Date is required" }),
  discountType: z.enum(["PERCENT", "AMOUNT"], { message: "DiscountType is required" }),
  value: z.coerce.number({ message: "Discount Amount is required" }).positive("Discount Amount is required"),
  applyOnMileage: z.boolean(),
});

/**
 * Settings > Rates > Pay Now Discounts (PayNowDiscountsMain.aspx / PayNowDiscountModify.aspx): the list with its Search
 * Options (Description, Location, Begin / End Date, Vehicle Types, Rates, Discount Type) and Add / Edit / Delete.
 * Partner Login Setup (PartnerLoginSetup.aspx) lives here too: the ten "Ask For …" ticks.
 */
export const payNowRouter = router({
  list: staffProcedure
    .input(
      z.object({
        search: z.string().optional(),
        locationIds: z.array(z.string()).optional(),
        vehicleTypeIds: z.array(z.string()).optional(),
        rateIds: z.array(z.string()).optional(),
        discountType: z.enum(["PERCENT", "AMOUNT"]).optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [rows, locs, rates, types] = await Promise.all([
        ctx.prisma.payNowDiscount.findMany({
          where: {
            ...(input.locationIds?.length ? { locationId: { in: input.locationIds } } : {}),
            ...(input.rateIds?.length ? { rateId: { in: input.rateIds } } : {}),
            ...(input.vehicleTypeIds?.length ? { OR: [{ vehicleTypeIds: { isEmpty: true } }, { vehicleTypeIds: { hasSome: input.vehicleTypeIds } }] } : {}),
            ...(input.discountType ? { discountType: input.discountType } : {}),
            ...(input.from ? { endsAt: { gte: input.from } } : {}),
            ...(input.to ? { startsAt: { lte: input.to } } : {}),
          },
          orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        }),
        ctx.prisma.location.findMany({ select: { id: true, name: true } }),
        ctx.prisma.rate.findMany({ select: { id: true, code: true } }),
        ctx.prisma.vehicleType.findMany({ select: { id: true, name: true } }),
      ]);
      const name = <T extends { id: string }>(xs: T[], id: string | null, f: (x: T) => string) => (id ? (xs.find((x) => x.id === id) ? f(xs.find((x) => x.id === id)!) : "(deleted)") : "");
      const needle = input.search?.trim().toLowerCase();
      return rows
        .map((r) => ({
          ...r,
          value: r.value.toFixed(2),
          description: name(rates, r.rateId, (x) => x.code) || "All rates",
          location: name(locs, r.locationId, (x) => x.name),
          vehicleTypes: r.vehicleTypeIds.length ? r.vehicleTypeIds.map((id) => name(types, id, (x) => x.name)).join(", ") : "All",
        }))
        .filter((r) => !needle || r.description.toLowerCase().includes(needle));
    }),
  get: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.payNowDiscount.findUniqueOrThrow({ where: { id: input.id } });
    return { ...r, value: r.value.toFixed(2) };
  }),
  save: permitted("RatesEdit")
    .input(z.object({ id: z.string().optional(), data: discountInput }))
    .mutation(async ({ ctx, input }) => {
      const d = input.data;
      if (+d.endsAt <= +d.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "End Date must be after Begin Date." });
      if (d.discountType === "PERCENT" && d.value > 100) throw new TRPCError({ code: "BAD_REQUEST", message: "A percent discount can be at most 100." });
      const data = { ...d, rateId: d.rateId || null };
      const r = input.id
        ? await ctx.prisma.payNowDiscount.update({ where: { id: input.id }, data })
        : await ctx.prisma.payNowDiscount.create({ data: { ...data, createdById: ctx.user.id } });
      await audit(ctx.prisma, "PayNowDiscount", r.id, ctx.user.id, { [input.id ? "Updated" : "Added"]: [null, `${d.discountType === "PERCENT" ? `${d.value}%` : `$${d.value}`}`] });
      return { id: r.id };
    }),
  remove: permitted("RatesEdit").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.payNowDiscount.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "PayNowDiscount", input.id, ctx.user.id, { Deleted: [null, "yes"] });
    return { ok: true };
  }),

  // ── Partner Login Setup
  partnerGet: staffProcedure.query(async ({ ctx }) => (await ctx.prisma.partnerLoginSetup.findUnique({ where: { id: "default" } })) ?? null),
  partnerSave: permitted("Settings")
    .input(
      z.object({
        askForCreditCard: z.boolean(),
        askForDriverLicense: z.boolean(),
        askForFullAddress: z.boolean(),
        askForBirthDate: z.boolean(),
        askForFlightInfo: z.boolean(),
        askForEmploymentInfo: z.boolean(),
        askForCompanyInfo: z.boolean(),
        askForInsuranceInfo: z.boolean(),
        askForSsn: z.boolean(),
        showDeliveryAddress: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.prisma.partnerLoginSetup.findUnique({ where: { id: "default" } });
      await ctx.prisma.partnerLoginSetup.upsert({ where: { id: "default" }, create: { id: "default", ...input, updatedById: ctx.user.id }, update: { ...input, updatedById: ctx.user.id } });
      await audit(
        ctx.prisma,
        "PartnerLoginSetup",
        "default",
        ctx.user.id,
        Object.fromEntries(Object.entries(input).map(([k, v]) => [k, [before ? (before as Record<string, unknown>)[k] : false, v]])),
      );
      return { ok: true };
    }),
});
