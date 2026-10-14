import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Settings > Rates: Misc Charges, Insurance Coverage, Master Rates, Seasons, Taxes; plus Settings > Locations
 * and Vehicle Setup > Vehicle Types.
 * Field names follow the legacy edit forms (MiscChargesModify / InsurancesModify / RatesModifyNew2).
 */

const D = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
const optStr = z.string().trim().max(4000).optional().nullable().transform((v) => v || null);
const num = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable());
const int = z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0));
const date = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable());
const calc = z.enum(["HOUR_24", "CALENDAR_DAY", "FLAT", "PERCENT"]);
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable());
const coord = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(-max).max(max).nullable());

/** Settings > Locations (LocationsModify.aspx), the fields the new system uses. */
const locationInput = z.object({
  name: req("Location name"),
  code: optStr,
  address1: optStr,
  address2: optStr,
  city: optStr,
  province: optStr,
  postal: optStr,
  country: optStr,
  phone: optStr,
  fax: optStr,
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || null),
  tollFree: optStr,
  closestIntersection: optStr,
  closestAirport: optStr,
  latitude: coord(90),
  longitude: coord(180),
  minimumAge: optInt,
  underAge: optInt,
  timeZone: z.enum(["America/Vancouver", "America/Edmonton"]),
  hoursNote: optStr,
  memo: optStr,
  isOffsite: z.boolean().default(false),
  isActive: z.boolean().default(false),
  displayOnline: z.boolean().default(false),
});

/** Vehicle Setup > Vehicle Types (VehicleTypesModify.aspx): the class itself. */
const vehicleTypeInput = z.object({
  name: req("Description"),
  code: optStr,
  sippCode: optStr,
  description: optStr,
  seats: optInt,
  doors: optInt,
  smallBags: optInt,
  largeBags: optInt,
  transmission: optStr,
  minimumAge: optInt,
  deposit: num,
  depositType: optStr,
  depositRequiredAtReservation: z.boolean().default(false),
  alwaysAvailable: z.boolean().default(false),
  airConditioner: z.boolean().default(false),
  specUrl: optStr,
  videoUrl: optStr,
  imageKey: optStr,
  effectiveDate: date,
  endDate: date,
  displayOnline: z.boolean().default(false),
  isActive: z.boolean().default(false),
  /** where it's offered, and how each location shows it online */
  locations: z.array(
    z.object({
      locationId: z.string(),
      offered: z.boolean(),
      displayOnline: z.boolean(),
      description: optStr,
      sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int()),
    }),
  ),
});

const listInput = z.object({ locationId: z.string().optional(), search: z.string().optional(), active: z.boolean().optional() });

const miscInput = z.object({
  locationId: optStr,
  name: req("Name"),
  code: req("Code"),
  calculationBy: calc,
  rate: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ required_error: "Rate is required" }).finite()),
  hourlyRate: num,
  weeklyRate: num,
  monthlyRate: num,
  extraDailyRate: num,
  graceMinutes: int,
  milesIncluded: int,
  effectiveDate: date,
  endDate: date,
  minDays: int,
  maxDays: int,
  group: optStr,
  description: optStr,
  allVehicleTypes: z.boolean().default(true),
  vehicleTypeIds: z.array(z.string()).default([]),
  displayOnline: z.boolean().default(false),
  rentcarsCom: z.boolean().default(false),
  defaultRentcarsCom: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  valuePricing: z.boolean().default(false),
  autoWhenUnderAge: z.boolean().default(false),
  autoWhenAdditionalDriver: z.boolean().default(false),
  isPrepaidFuel: z.boolean().default(false),
  isNoShowCharge: z.boolean().default(false),
  multiSelectOnline: z.boolean().default(false),
  displayAtStartRental: z.boolean().default(true),
  displayAtEndRental: z.boolean().default(true),
  tollAdminFeeWaiver: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const insuranceInput = z.object({
  locationId: optStr,
  name: req("Name"),
  code: req("Code"),
  calculationBy: calc.exclude(["PERCENT"]),
  dailyRate: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ required_error: "Daily rate is required" }).finite()),
  hourlyRate: num,
  weeklyRate: num,
  monthlyRate: num,
  extraDailyRate: num,
  deductible: num,
  graceMinutes: int,
  effectiveDate: date,
  endDate: date,
  minDays: int,
  maxDays: int,
  group: optStr,
  description: optStr,
  allVehicleTypes: z.boolean().default(true),
  vehicleTypeIds: z.array(z.string()).default([]),
  displayOnline: z.boolean().default(false),
  rentcarsCom: z.boolean().default(false),
  defaultRentcarsCom: z.boolean().default(false),
  valuePricing: z.boolean().default(false),
  isDeposit: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const rateValueInput = z.object({
  vehicleTypeId: z.string(),
  seasonId: z.string().nullable(),
  hourly: num,
  daily: num,
  extraDaily: num,
  weekly: num,
  monthly: num,
  kmAllowed: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  kmHourly: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  kmWeekly: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  kmMonthly: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  extraKmCharge: num,
});

const rateInput = z.object({
  locationId: req("Location"),
  code: req("Rate code"),
  calculationBy: calc.exclude(["PERCENT"]),
  rateType: req("Rate type"),
  minDays: int,
  minHours: int,
  minMinutes: int,
  maxDays: int,
  maxHours: int,
  maxMinutes: int,
  validFor: z.enum(["DATE_RANGE", "SEASON"]),
  effectiveDate: date,
  endDate: date,
  seasonIds: z.array(z.string()).default([]),
  extraKmCharge: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().min(0)),
  graceMinutes: int,
  fuelChargePerUnit: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().min(0)),
  minChargeDays: int,
  minChargeHours: int,
  skipHourly: z.boolean().default(false),
  displayOnline: z.boolean().default(false),
  valuePricing: z.boolean().default(false),
  dateSpecific: z.boolean().default(false),
  rentcarsCom: z.boolean().default(false),
  isActive: z.boolean().default(true),
  availableDays: z.array(z.boolean()).length(7).default([true, true, true, true, true, true, true]),
});

function moneyFields<T extends Record<string, unknown>>(o: T, keys: (keyof T)[]) {
  const out: Record<string, unknown> = { ...o };
  for (const k of keys) out[k as string] = D(o[k] as number | null);
  return out;
}

export const settingsRouter = router({
  lookups: staffProcedure.query(async ({ ctx }) => {
    const [locations, vehicleTypes, seasons] = await Promise.all([
      ctx.prisma.location.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
      ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.season.findMany({ orderBy: { startDate: "asc" }, select: { id: true, name: true, startDate: true, endDate: true } }),
    ]);
    return { locations, vehicleTypes, seasons };
  }),

  // ── Misc charges ───────────────────────────────────────────────────────────
  miscList: staffProcedure.input(listInput).query(({ ctx, input }) =>
    ctx.prisma.miscCharge.findMany({
      where: {
        ...(input.locationId ? { OR: [{ locationId: input.locationId }, { locationId: null }] } : {}),
        isActive: input.active,
        ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { code: { contains: input.search, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, rate: true, calculationBy: true, isActive: true, displayOnline: true, isDefault: true, isMandatory: true, group: true, location: { select: { name: true } } },
    }),
  ),
  miscGet: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const m = await ctx.prisma.miscCharge.findUnique({ where: { id: input.id }, include: { vehicleTypes: { select: { vehicleTypeId: true } } } });
    if (!m) throw new TRPCError({ code: "NOT_FOUND" });
    return m;
  }),
  miscSave: staffProcedure.input(z.object({ id: z.string().optional(), data: miscInput })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const { vehicleTypeIds, ...d } = input.data;
      const data = moneyFields(d, ["rate", "hourlyRate", "weeklyRate", "monthlyRate", "extraDailyRate"]) as Prisma.MiscChargeUncheckedCreateInput;
      const saved = input.id ? await tx.miscCharge.update({ where: { id: input.id }, data }) : await tx.miscCharge.create({ data });
      await tx.miscChargeVehicleType.deleteMany({ where: { miscChargeId: saved.id } });
      if (!d.allVehicleTypes && vehicleTypeIds.length)
        await tx.miscChargeVehicleType.createMany({ data: vehicleTypeIds.map((vehicleTypeId) => ({ miscChargeId: saved.id, vehicleTypeId })) });
      await audit(tx, "MiscCharge", saved.id, ctx.user.id, { Saved: [null, saved.name] });
      return { id: saved.id };
    }),
  ),

  // ── Insurance coverage ─────────────────────────────────────────────────────
  insuranceList: staffProcedure.input(listInput).query(({ ctx, input }) =>
    ctx.prisma.insurance.findMany({
      where: {
        ...(input.locationId ? { OR: [{ locationId: input.locationId }, { locationId: null }] } : {}),
        isActive: input.active,
        ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { code: { contains: input.search, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, dailyRate: true, deductible: true, isActive: true, displayOnline: true, isDefault: true, group: true, location: { select: { name: true } } },
    }),
  ),
  insuranceGet: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const i = await ctx.prisma.insurance.findUnique({ where: { id: input.id }, include: { vehicleTypes: { select: { vehicleTypeId: true } } } });
    if (!i) throw new TRPCError({ code: "NOT_FOUND" });
    return i;
  }),
  insuranceSave: staffProcedure.input(z.object({ id: z.string().optional(), data: insuranceInput })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const { vehicleTypeIds, ...d } = input.data;
      const data = moneyFields(d, ["dailyRate", "hourlyRate", "weeklyRate", "monthlyRate", "extraDailyRate", "deductible"]) as Prisma.InsuranceUncheckedCreateInput;
      const saved = input.id ? await tx.insurance.update({ where: { id: input.id }, data }) : await tx.insurance.create({ data });
      await tx.insuranceVehicleType.deleteMany({ where: { insuranceId: saved.id } });
      if (!d.allVehicleTypes && vehicleTypeIds.length)
        await tx.insuranceVehicleType.createMany({ data: vehicleTypeIds.map((vehicleTypeId) => ({ insuranceId: saved.id, vehicleTypeId })) });
      await audit(tx, "Insurance", saved.id, ctx.user.id, { Saved: [null, saved.name] });
      return { id: saved.id };
    }),
  ),

  // ── Master rates ───────────────────────────────────────────────────────────
  rateList: staffProcedure.input(listInput).query(({ ctx, input }) =>
    ctx.prisma.rate.findMany({
      where: {
        locationId: input.locationId,
        isActive: input.active,
        ...(input.search ? { code: { contains: input.search, mode: "insensitive" } } : {}),
      },
      orderBy: [{ location: { name: "asc" } }, { minDays: "asc" }, { code: "asc" }],
      select: {
        id: true, code: true, calculationBy: true, rateType: true, validFor: true, effectiveDate: true, endDate: true,
        minDays: true, maxDays: true, displayOnline: true, isActive: true,
        location: { select: { name: true } },
        seasons: { select: { season: { select: { name: true } } } },
        _count: { select: { values: true } },
      },
    }),
  ),
  rateGet: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.rate.findUnique({
      where: { id: input.id },
      include: { seasons: { select: { seasonId: true } }, values: true },
    });
    if (!r) throw new TRPCError({ code: "NOT_FOUND" });
    return r;
  }),
  rateSave: staffProcedure
    .input(z.object({ id: z.string().optional(), data: rateInput, values: z.array(rateValueInput).default([]) }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { seasonIds, extraKmCharge, fuelChargePerUnit, minChargeHours, ...d } = input.data;
        const data = { ...d, extraKmCharge: new Prisma.Decimal(extraKmCharge), fuelChargePerUnit: new Prisma.Decimal(fuelChargePerUnit), minChargeHours: minChargeHours || null };
        const saved = input.id ? await tx.rate.update({ where: { id: input.id }, data }) : await tx.rate.create({ data });
        await tx.rateSeason.deleteMany({ where: { rateId: saved.id } });
        if (d.validFor === "SEASON" && seasonIds.length) await tx.rateSeason.createMany({ data: seasonIds.map((seasonId) => ({ rateId: saved.id, seasonId })) });
        // replace values (rows with no daily price are dropped)
        await tx.rateValue.deleteMany({ where: { rateId: saved.id } });
        const rows = input.values.filter((v) => v.daily != null || v.hourly != null || v.weekly != null || v.monthly != null);
        if (rows.length)
          await tx.rateValue.createMany({
            data: rows.map((v) => ({
              rateId: saved.id,
              vehicleTypeId: v.vehicleTypeId,
              seasonId: d.validFor === "SEASON" ? v.seasonId : null,
              hourly: D(v.hourly), daily: D(v.daily), extraDaily: D(v.extraDaily), weekly: D(v.weekly), monthly: D(v.monthly),
              kmAllowed: v.kmAllowed, kmHourly: v.kmHourly, kmWeekly: v.kmWeekly, kmMonthly: v.kmMonthly, extraKmCharge: D(v.extraKmCharge),
            })),
          });
        await audit(tx, "Rate", saved.id, ctx.user.id, { Saved: [null, saved.code] });
        return { id: saved.id };
      }),
    ),

  // ── Locations ──────────────────────────────────────────────────────────────
  locationList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.location.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { _count: { select: { vehiclesRental: { where: { isActive: true } }, vehicleTypes: { where: { displayOnline: true, isActive: true } } } } },
    }),
  ),
  locationSave: staffProcedure.input(z.object({ id: z.string(), data: locationInput })).mutation(async ({ ctx, input }) => {
    const before = await ctx.prisma.location.findUnique({ where: { id: input.id } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Location not found" });
    const { latitude, longitude, ...rest } = input.data;
    const data = { ...rest, latitude: D(latitude), longitude: D(longitude), isLegacy: !rest.isActive };
    await ctx.prisma.$transaction(async (tx) => {
      await tx.location.update({ where: { id: before.id }, data });
      await audit(tx, "Location", before.id, ctx.user.id, Object.fromEntries(Object.entries(data).map(([k, v]) => [k, [(before as Record<string, unknown>)[k], v]])));
    });
    return { id: before.id };
  }),

  // ── Vehicle types (classes) ────────────────────────────────────────────────
  vehicleTypeList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.vehicleType.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true, name: true, code: true, seats: true, doors: true, imageKey: true, isActive: true, displayOnline: true,
        locations: { where: { isActive: true }, select: { displayOnline: true, location: { select: { id: true, name: true } } } },
        _count: { select: { vehicles: { where: { isActive: true } } } },
      },
    }),
  ),
  vehicleTypeGet: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [t, locations] = await Promise.all([
      ctx.prisma.vehicleType.findUnique({ where: { id: input.id }, include: { locations: true } }),
      ctx.prisma.location.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true, isActive: true, displayOnline: true } }),
    ]);
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle type not found" });
    return { type: t, locations };
  }),
  vehicleTypeSave: staffProcedure.input(z.object({ id: z.string(), data: vehicleTypeInput })).mutation(async ({ ctx, input }) => {
    const before = await ctx.prisma.vehicleType.findUnique({ where: { id: input.id }, include: { locations: true } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle type not found" });
    const { locations, deposit, ...rest } = input.data;
    const data = { ...rest, deposit: D(deposit), luggage: (rest.smallBags ?? 0) + (rest.largeBags ?? 0) || null };
    try {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.vehicleType.update({ where: { id: before.id }, data });
        for (const l of locations) {
          const prev = before.locations.find((x) => x.locationId === l.locationId);
          const row = { displayOnline: l.displayOnline, description: l.description, sortOrder: l.sortOrder, isActive: l.offered };
          if (prev) await tx.vehicleTypeLocation.update({ where: { id: prev.id }, data: row });
          else if (l.offered) await tx.vehicleTypeLocation.create({ data: { vehicleTypeId: before.id, locationId: l.locationId, ...row } });
        }
        await audit(tx, "VehicleType", before.id, ctx.user.id, {
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, [(before as Record<string, unknown>)[k], v]])),
          locations: [
            before.locations.filter((x) => x.isActive).map((x) => `${x.locationId}${x.displayOnline ? "*" : ""}`).sort().join(","),
            locations.filter((x) => x.offered).map((x) => `${x.locationId}${x.displayOnline ? "*" : ""}`).sort().join(","),
          ],
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new TRPCError({ code: "CONFLICT", message: "Another vehicle type already has this description." });
      throw e;
    }
    return { id: before.id };
  }),

  // ── Seasons & taxes ────────────────────────────────────────────────────────
  seasonList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.season.findMany({ orderBy: { startDate: "asc" }, include: { _count: { select: { rates: true } } } }),
  ),
  seasonSave: staffProcedure
    .input(z.object({ id: z.string().optional(), name: req("Name"), startDate: z.coerce.date(), endDate: z.coerce.date() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const s = id ? await ctx.prisma.season.update({ where: { id }, data }) : await ctx.prisma.season.create({ data });
      return { id: s.id };
    }),
  taxList: staffProcedure.query(({ ctx }) =>
    ctx.prisma.tax.findMany({ orderBy: { name: "asc" }, include: { locations: { select: { location: { select: { id: true, name: true } } } } } }),
  ),
  taxSave: staffProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: req("Name"),
        kind: z.enum(["PERCENT", "AMOUNT"]),
        value: z.coerce.number(),
        perDay: z.boolean().default(false),
        isActive: z.boolean().default(true),
        locationIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { id, locationIds, value, ...rest } = input;
        const data = { ...rest, value: new Prisma.Decimal(value) };
        const t = id ? await tx.tax.update({ where: { id }, data }) : await tx.tax.create({ data });
        await tx.locationTax.deleteMany({ where: { taxId: t.id } });
        if (locationIds.length) await tx.locationTax.createMany({ data: locationIds.map((locationId) => ({ locationId, taxId: t.id })) });
        return { id: t.id };
      }),
    ),
});
