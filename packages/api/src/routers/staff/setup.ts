import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure, permitted, requirePermission } from "../../trpc";
import { BUILTIN_PAYMENT_METHODS, paymentMethodInput } from "../../lib/payment-methods";

/**
 * Settings pages for the simple lists RentCentric keeps under Settings: pick lists (Vehicle Setup > Categories / Body
 * Types / Fuel Types / Engine Brands & Types / Vehicle Options, Company > Company Type, Location > Customer
 * Areas/Regions, discount and rental reasons), Makes & Models, Companies / Corporates, Hours Of Operation, Equipment.
 */

const optStr = z.string().trim().max(4000).optional().nullable().transform((v) => v || null);
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable());
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);
const kind = z.enum(["VEHICLE_CATEGORY", "VEHICLE_BODY", "FUEL_TYPE", "ENGINE_BRAND", "ENGINE_TYPE", "VEHICLE_OPTION", "COMPANY_TYPE", "CUSTOMER_REGION", "DISCOUNT_REASON", "RENTAL_REASON", "PAYMENT_DETAIL", "DAMAGE_LOCATION", "DAMAGE_CONDITION", "VEHICLE_GROUP", "TITLE_LOCATION", "REGISTERED_OWNER", "SIPP_CODE"]);
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use hh:mm").optional().nullable().or(z.literal("")).transform((v) => v || null);

const inUse = (what: string) => new TRPCError({ code: "CONFLICT", message: `This ${what} is in use, so it can't be deleted. Make it inactive instead.` });
const isFkError = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2003";

/** Settings > Company > Companies / Corporates (CompaniesModify.aspx fields). */
const companyInput = z.object({
  name: req("Company name"),
  typeId: optStr,
  code: optStr,
  contactName: optStr,
  address1: optStr,
  address2: optStr,
  city: optStr,
  province: optStr,
  postal: optStr,
  country: optStr,
  phone: optStr,
  fax: optStr,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || null),
  taxName: optStr,
  taxAddress: optStr,
  taxId: optStr,
  claimsOffice: optStr,
  minimumAge: optInt,
  insuranceCompany: optStr,
  insuranceRep: optStr,
  policyNumber: optStr,
  policyExpiry: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable()),
  mileageCap: optInt,
  iataNumber: optStr,
  copyInsuranceToRental: z.boolean().default(false),
  isUndesired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const setupRouter = router({
  // ── Settings > Financial / Commission > Commission Structures (CommissionStructureMain / Modify2) ──

  commissionStructures: staffProcedure.query(({ ctx }) => ctx.prisma.commissionStructure.findMany({ orderBy: { name: "asc" }, include: { location: { select: { name: true } } } })),
  /** The rows of the structure grid: Net Rate, Mileage, Prepaid Fuel, then every insurance, misc charge and tax (by name). */
  commissionItems: staffProcedure.query(async ({ ctx }) => {
    const [ins, misc, taxes] = await Promise.all([
      ctx.prisma.insurance.findMany({ where: { isActive: true }, distinct: ["name"], orderBy: { name: "asc" }, select: { name: true } }),
      ctx.prisma.miscCharge.findMany({ where: { isActive: true }, distinct: ["name"], orderBy: { name: "asc" }, select: { name: true } }),
      ctx.prisma.tax.findMany({ where: { isActive: true }, distinct: ["name"], orderBy: { name: "asc" }, select: { name: true } }),
    ]);
    return [
      { group: "", items: [["NET_RATE", "Net Rate"], ["MILEAGE", "Mileage"], ["PREPAID_FUEL", "Prepaid Fuel"]] },
      { group: "Insurances", items: ins.map((x) => [`INS:${x.name}`, x.name]) },
      { group: "Misc. Charges", items: misc.map((x) => [`MISC:${x.name}`, x.name]) },
      { group: "Taxes", items: taxes.map((x) => [`TAX:${x.name}`, x.name]) },
    ] as { group: string; items: [string, string][] }[];
  }),
  commissionStructureSave: permitted("Settings")
    .input(
      z.object({
        id: z.string().optional(),
        name: req("Commission Structure Name"),
        locationId: optStr,
        rules: z.record(z.string(), z.record(z.enum(["res", "open", "close", "walkin"]), z.object({ amount: z.number().min(0), type: z.enum(["DAILY", "PERCENT", "AMOUNT"]) }))),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const c = id ? await ctx.prisma.commissionStructure.update({ where: { id }, data }) : await ctx.prisma.commissionStructure.create({ data });
      return { id: c.id };
    }),
  commissionStructureDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const users = await ctx.prisma.user.count({ where: { commissionStructureIds: { has: input.id } } });
    if (users) throw new TRPCError({ code: "CONFLICT", message: `${users} user(s) have this structure; untick it on their user first.` });
    await ctx.prisma.commissionStructure.delete({ where: { id: input.id } });
  }),

  // ── Settings > Website & Email > Promotions/Specials (DiscountPromoMain / DiscountPromoModify) ──

  promoList: staffProcedure.query(({ ctx }) => ctx.prisma.promoCode.findMany({ orderBy: [{ isActive: "desc" }, { startDate: "desc" }], include: { _count: { select: { reservations: true } } } })),
  promoSave: permitted("Settings")
    .input(
      z
        .object({
          id: z.string().optional(),
          category: z.enum(["RESERVATION", "REGISTRATION"]),
          code: z.string().trim().min(1, "Promotion Code is required").max(40).regex(/^\S+$/, "No spaces"),
          startDate: z.coerce.date({ invalid_type_error: "Start Date is required" }),
          endDate: z.coerce.date({ invalid_type_error: "End Date is required" }),
          expirationDate: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable()),
          discountType: z.enum(["PERCENT", "AMOUNT"], { required_error: "Discount Type is required" }),
          discountValue: z.coerce.number({ invalid_type_error: "Discount Value is required" }).min(0),
          kmDiscountType: z.preprocess((v) => (v === "" ? null : v), z.enum(["PERCENT", "AMOUNT"]).nullable()),
          kmDiscountValue: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()),
          minDays: z.coerce.number().int().min(1).default(1),
          isActive: z.boolean(),
          autoApply: z.boolean(),
          oneTimeUse: z.boolean(),
          locationIds: z.array(z.string()).default([]),
          vehicleTypeIds: z.array(z.string()).default([]),
        })
        .superRefine((v, c) => {
          if (v.endDate < v.startDate) c.addIssue({ code: "custom", path: ["endDate"], message: "End Date must be after Start Date" });
          if (v.discountType === "PERCENT" && v.discountValue > 100) c.addIssue({ code: "custom", path: ["discountValue"], message: "Can't exceed 100%" });
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const dup = await ctx.prisma.promoCode.findFirst({ where: { code: { equals: data.code, mode: "insensitive" }, NOT: id ? { id } : undefined }, select: { id: true } });
      if (dup) throw new TRPCError({ code: "CONFLICT", message: `Promo code "${data.code}" already exists.` });
      const p = id ? await ctx.prisma.promoCode.update({ where: { id }, data }) : await ctx.prisma.promoCode.create({ data });
      return { id: p.id };
    }),
  promoDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const p = await ctx.prisma.promoCode.findUniqueOrThrow({ where: { id: input.id }, include: { _count: { select: { reservations: true } } } });
    if (p._count.reservations) throw new TRPCError({ code: "CONFLICT", message: `${p.code} was used on ${p._count.reservations} reservation(s); set it Inactive instead.` });
    await ctx.prisma.promoCode.delete({ where: { id: p.id } });
  }),

  // ── Settings > Financial / Commission > Referrals (source of referral) ──

  referralList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.referral.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { reservations: true, rentals: true, customers: true, commissions: true } } } }),
  ),
  referralSave: permitted("Settings")
    .input(
      z.object({
        id: z.string().optional(),
        name: req("Referral"),
        fullName: optStr,
        email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || null),
        phone: optStr,
        fax: optStr,
        memo: optStr,
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const dup = await ctx.prisma.referral.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, NOT: id ? { id } : undefined }, select: { id: true } });
      if (dup) throw new TRPCError({ code: "CONFLICT", message: `Referral "${data.name}" already exists.` });
      const r = id ? await ctx.prisma.referral.update({ where: { id }, data }) : await ctx.prisma.referral.create({ data });
      return { id: r.id };
    }),
  referralDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.prisma.referral.findUniqueOrThrow({ where: { id: input.id }, include: { _count: { select: { quotes: true, reservations: true, rentals: true, customers: true, commissions: true } } } });
    const used = Object.values(r._count).reduce((a, n) => a + n, 0);
    if (used) throw new TRPCError({ code: "CONFLICT", message: `${r.name} is used on ${used} booking(s) / customer(s); make it inactive instead.` });
    await ctx.prisma.referral.delete({ where: { id: r.id } });
  }),

  // ── Settings > One Way Regions (LocationRegionsMain) and One Way Rates (OneWay.aspx / OneWaysModify.aspx) ──

  oneWayRegions: staffProcedure.query(({ ctx }) =>
    ctx.prisma.oneWayRegion.findMany({ orderBy: { name: "asc" }, include: { locations: { select: { name: true } }, _count: { select: { ratesFrom: true, ratesTo: true } } } }),
  ),
  oneWayRegionSave: permitted("Settings").input(z.object({ id: z.string().optional(), name: req("Region") })).mutation(async ({ ctx, input }) => {
    const dup = await ctx.prisma.oneWayRegion.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, NOT: input.id ? { id: input.id } : undefined } });
    if (dup) throw new TRPCError({ code: "CONFLICT", message: `Region "${input.name}" already exists.` });
    const r = input.id ? await ctx.prisma.oneWayRegion.update({ where: { id: input.id }, data: { name: input.name } }) : await ctx.prisma.oneWayRegion.create({ data: { name: input.name } });
    return { id: r.id };
  }),
  oneWayRegionDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.prisma.oneWayRegion.findUniqueOrThrow({ where: { id: input.id }, include: { _count: { select: { locations: true, ratesFrom: true, ratesTo: true } } } });
    const used = r._count.locations + r._count.ratesFrom + r._count.ratesTo;
    if (used) throw new TRPCError({ code: "CONFLICT", message: `${r.name} is used by ${r._count.locations} location(s) and ${r._count.ratesFrom + r._count.ratesTo} one way rate(s); it can't be deleted.` });
    await ctx.prisma.oneWayRegion.delete({ where: { id: input.id } });
  }),

  oneWayRates: staffProcedure.input(z.object({ vehicleTypeId: z.string().optional() }).default({})).query(({ ctx, input }) =>
    ctx.prisma.oneWayRate.findMany({
      where: input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {},
      orderBy: [{ fromRegion: { name: "asc" } }, { toRegion: { name: "asc" } }, { startDate: "asc" }],
      include: { fromRegion: { select: { name: true } }, toRegion: { select: { name: true } }, vehicleType: { select: { name: true } } },
    }),
  ),
  oneWayRateSave: permitted("Settings")
    .input(
      z
        .object({
          id: z.string().optional(),
          fromRegionId: req("One Way From"),
          toRegionId: req("One Way To"),
          addReverse: z.boolean().default(false),
          fee: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ required_error: "Fee is required", invalid_type_error: "Fee is required" }).min(0)),
          odometer: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
          numberOfDays: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
          vehicleTypeId: optStr,
          competitionRate1: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()),
          competitionRate2: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()),
          competitionRate3: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable()),
          startDate: z.coerce.date({ invalid_type_error: "Start Date is required" }),
          endDate: z.coerce.date({ invalid_type_error: "End Date is required" }),
          memo: optStr,
        })
        .superRefine((v, c) => {
          if (v.fromRegionId === v.toRegionId) c.addIssue({ code: "custom", path: ["toRegionId"], message: "One Way To must be a different region" });
          if (v.endDate < v.startDate) c.addIssue({ code: "custom", path: ["endDate"], message: "End Date must be after Start Date" });
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, addReverse, ...data } = input;
      const r = id ? await ctx.prisma.oneWayRate.update({ where: { id }, data }) : await ctx.prisma.oneWayRate.create({ data });
      // "Add Reverse": the same fee the other way round
      if (addReverse) await ctx.prisma.oneWayRate.create({ data: { ...data, fromRegionId: data.toRegionId, toRegionId: data.fromRegionId } });
      return { id: r.id };
    }),
  oneWayRateDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.oneWayRate.delete({ where: { id: input.id } });
  }),

  // ── Pick lists ─────────────────────────────────────────────────────────────
  lookupList: staffProcedure.input(z.object({ kind })).query(({ ctx, input }) =>
    ctx.prisma.lookup.findMany({ where: { kind: input.kind }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ),
  lookupSave: permitted("Settings")
    .input(z.object({ id: z.string().optional(), kind, name: req("Name"), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const clash = await ctx.prisma.lookup.findFirst({ where: { kind: data.kind, name: data.name, NOT: id ? { id } : undefined } });
      if (clash) throw new TRPCError({ code: "CONFLICT", message: `“${data.name}” is already on this list` });
      const r = id ? await ctx.prisma.lookup.update({ where: { id }, data }) : await ctx.prisma.lookup.create({ data });
      return { id: r.id };
    }),
  lookupDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    // the links are optional (the database would just clear them on vehicles, customers, rentals …), so check first
    const l = await ctx.prisma.lookup.findUnique({
      where: { id: input.id },
      select: { _count: { select: { vehiclesCategory: true, vehiclesBody: true, vehiclesFuelType: true, vehiclesEngineBrand: true, vehiclesEngineType: true, vehicleOptions: true, companies: true, customersRegion: true, reservationsDiscount: true, rentalsDiscount: true, rentalsReason: true, damagesLocation: true, damagesCondition: true } } },
    });
    if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    if (Object.values(l._count).some(Boolean)) throw inUse("item");
    await ctx.prisma.lookup.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  // ── Makes & models ─────────────────────────────────────────────────────────
  makeList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.vehicleMake.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { vehicles: true } }, models: { orderBy: { name: "asc" }, include: { _count: { select: { vehicles: true } } } } },
    }),
  ),
  makeSave: permitted("VehiclesEdit").input(z.object({ id: z.string().optional(), name: req("Make") })).mutation(async ({ ctx, input }) => {
    const clash = await ctx.prisma.vehicleMake.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, NOT: input.id ? { id: input.id } : undefined } });
    if (clash) throw new TRPCError({ code: "CONFLICT", message: `${input.name} already exists` });
    const r = input.id ? await ctx.prisma.vehicleMake.update({ where: { id: input.id }, data: { name: input.name } }) : await ctx.prisma.vehicleMake.create({ data: { name: input.name } });
    return { id: r.id };
  }),
  modelSave: permitted("VehiclesEdit").input(z.object({ id: z.string().optional(), makeId: z.string(), name: req("Model"), code: optStr })).mutation(async ({ ctx, input }) => {
    const clash = await ctx.prisma.vehicleModel.findFirst({ where: { makeId: input.makeId, name: { equals: input.name, mode: "insensitive" }, NOT: input.id ? { id: input.id } : undefined } });
    if (clash) throw new TRPCError({ code: "CONFLICT", message: `${input.name} already exists for this make` });
    const { id, ...data } = input;
    const r = id ? await ctx.prisma.vehicleModel.update({ where: { id }, data }) : await ctx.prisma.vehicleModel.create({ data });
    return { id: r.id };
  }),
  makeDelete: permitted("VehiclesDelete").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.prisma.$transaction([ctx.prisma.vehicleModel.deleteMany({ where: { makeId: input.id } }), ctx.prisma.vehicleMake.delete({ where: { id: input.id } })]);
    } catch (e) {
      if (isFkError(e)) throw new TRPCError({ code: "CONFLICT", message: "Vehicles use this make, so it can't be deleted." });
      throw e;
    }
    return { ok: true };
  }),
  modelDelete: permitted("VehiclesDelete").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.prisma.vehicleModel.delete({ where: { id: input.id } });
    } catch (e) {
      if (isFkError(e)) throw new TRPCError({ code: "CONFLICT", message: "Vehicles use this model, so it can't be deleted." });
      throw e;
    }
    return { ok: true };
  }),

  // ── Companies / corporates ─────────────────────────────────────────────────
  companyList: permitted("Company")
    .input(z.object({ q: z.string().optional(), status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE") }))
    .query(({ ctx, input }) => {
      const q = input.q?.trim();
      return ctx.prisma.company.findMany({
        where: {
          ...(input.status === "ALL" ? {} : { isActive: input.status === "ACTIVE" }),
          ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
        },
        orderBy: { name: "asc" },
        take: 500,
        include: { type: { select: { name: true } }, _count: { select: { rentals: true, reservations: true, customers: true } } },
      });
    }),
  companyGet: permitted("Company").input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const c = await ctx.prisma.company.findUnique({ where: { id: input.id } });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    return c;
  }),
  companySave: permitted("Company")
    .input(z.object({ id: z.string().optional(), data: companyInput }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx, input.id ? "CompanyEdit" : "CompanyAdd");
      const r = input.id ? await ctx.prisma.company.update({ where: { id: input.id }, data: input.data }) : await ctx.prisma.company.create({ data: input.data });
      return { id: r.id };
    }),
  companyDelete: permitted("CompanyDelete").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.company.findUnique({
      where: { id: input.id },
      select: { _count: { select: { customers: true, quotes: true, reservations: true, rentals: true, payments: true, billSplits: true, iataChildren: true } } },
    });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
    if (Object.values(c._count).some(Boolean)) throw inUse("company");
    await ctx.prisma.company.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  // ── Hours of operation ─────────────────────────────────────────────────────
  hoursGet: staffProcedure.input(z.object({ locationId: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.locationHours.findMany({ where: { locationId: input.locationId }, orderBy: { dayOfWeek: "asc" } }),
  ),
  hoursSave: permitted("LocationsEdit")
    .input(z.object({ locationId: z.string(), days: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), opensAt: time, closesAt: time, isClosed: z.boolean() })).length(7) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(
        input.days.map((d) =>
          ctx.prisma.locationHours.upsert({
            where: { locationId_dayOfWeek: { locationId: input.locationId, dayOfWeek: d.dayOfWeek } },
            create: { locationId: input.locationId, ...d },
            update: d,
          }),
        ),
      ).then(() => ({ ok: true })),
    ),

  // ── Equipment ──────────────────────────────────────────────────────────────
  equipmentList: staffProcedure.query(({ ctx }) => ctx.prisma.equipment.findMany({ orderBy: { name: "asc" } })),
  equipmentSave: permitted("Settings")
    .input(z.object({ id: z.string().optional(), name: req("Name"), quantity: z.coerce.number().int().min(0, "Can't be negative"), isActive: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const r = id ? await ctx.prisma.equipment.update({ where: { id }, data }) : await ctx.prisma.equipment.create({ data });
      return { id: r.id };
    }),
  equipmentDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.equipment.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  // ── Payment methods (Settings > Payment Settings > Payment Methods / Default Payment Method) ──
  paymentMethodList: staffProcedure.input(z.object({ locationId: z.string() })).query(async ({ ctx, input }) => {
    const [methods, loc] = await Promise.all([
      ctx.prisma.locationPaymentMethod.findMany({ where: { locationId: input.locationId }, orderBy: { name: "asc" } }),
      ctx.prisma.location.findUnique({ where: { id: input.locationId }, select: { defaultPaymentMethod: true } }),
    ]);
    return { methods, defaultMethod: loc?.defaultPaymentMethod ?? null };
  }),
  paymentMethodSave: permitted("Settings")
    .input(z.object({ id: z.string().optional(), locationId: z.string(), name: req("Payment Method").max(60), isCreditCard: z.boolean().default(false), creditCardType: optStr, isDefault: z.boolean().default(false), mobileAgentIncluded: z.boolean().default(false), isActive: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if ((BUILTIN_PAYMENT_METHODS as readonly string[]).some((b) => b.toLowerCase() === data.name.toLowerCase()))
        throw new TRPCError({ code: "CONFLICT", message: `${data.name} is already a built-in payment method` });
      const clash = await ctx.prisma.locationPaymentMethod.findFirst({ where: { locationId: data.locationId, name: { equals: data.name, mode: "insensitive" }, NOT: id ? { id } : undefined } });
      if (clash) throw new TRPCError({ code: "CONFLICT", message: `“${data.name}” already exists at this location` });
      const r = await ctx.prisma.$transaction(async (tx) => {
        const before = id ? await tx.locationPaymentMethod.findUnique({ where: { id } }) : null;
        const row = id ? await tx.locationPaymentMethod.update({ where: { id }, data }) : await tx.locationPaymentMethod.create({ data });
        // "Default" makes it the location's default payment method (one default per location)
        if (data.isDefault) {
          await tx.locationPaymentMethod.updateMany({ where: { locationId: data.locationId, NOT: { id: row.id } }, data: { isDefault: false } });
          await tx.location.update({ where: { id: data.locationId }, data: { defaultPaymentMethod: `OTHER:${row.name}` } });
        } else if (before?.isDefault) {
          await tx.location.update({ where: { id: data.locationId }, data: { defaultPaymentMethod: null } });
        }
        return row;
      });
      return { id: r.id };
    }),
  paymentMethodDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const m = await ctx.prisma.locationPaymentMethod.findUnique({ where: { id: input.id } });
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
    const used = await ctx.prisma.payment.count({ where: { method: "OTHER", methodName: m.name } });
    if (used) throw inUse("payment method");
    await ctx.prisma.$transaction([
      ctx.prisma.locationPaymentMethod.delete({ where: { id: m.id } }),
      ...(m.isDefault ? [ctx.prisma.location.update({ where: { id: m.locationId }, data: { defaultPaymentMethod: null } })] : []),
    ]);
    return { ok: true };
  }),
  /** Default Payment Method (DefaultPaymentMethod.aspx): a built-in method or one of the location's own. */
  paymentMethodSetDefault: permitted("Settings")
    .input(z.object({ locationId: z.string(), method: paymentMethodInput.nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction([
        ctx.prisma.locationPaymentMethod.updateMany({ where: { locationId: input.locationId }, data: { isDefault: false } }),
        ...(input.method?.startsWith("OTHER:") ? [ctx.prisma.locationPaymentMethod.updateMany({ where: { locationId: input.locationId, name: input.method.slice(6) }, data: { isDefault: true } })] : []),
        ctx.prisma.location.update({ where: { id: input.locationId }, data: { defaultPaymentMethod: input.method } }),
      ]);
      return { ok: true };
    }),
  /** The payment method choices for a booking at a location: the built-ins, then the location's own; with its default. */
  paymentMethodOptions: staffProcedure.input(z.object({ locationId: z.string().optional() })).query(async ({ ctx, input }) => {
    const LABEL: Record<string, string> = { AMEX: "Amex", CASH: "Cash", DEBIT: "Debit", EMT: "EMT", INTERNAL: "Internal", MASTERCARD: "Mastercard", VISA: "Visa" };
    const builtins = BUILTIN_PAYMENT_METHODS.map((m) => ({ value: m as string, label: LABEL[m]! }));
    if (!input.locationId) return { options: builtins, defaultMethod: null as string | null };
    const [own, loc] = await Promise.all([
      ctx.prisma.locationPaymentMethod.findMany({ where: { locationId: input.locationId, isActive: true }, orderBy: { name: "asc" } }),
      ctx.prisma.location.findUnique({ where: { id: input.locationId }, select: { defaultPaymentMethod: true } }),
    ]);
    return { options: [...builtins, ...own.map((m) => ({ value: `OTHER:${m.name}`, label: m.name }))], defaultMethod: loc?.defaultPaymentMethod ?? null };
  }),
});

