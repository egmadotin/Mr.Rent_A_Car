import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";
import { VEHICLE_STATUS_VALUES } from "../../lib/vehicle-status";
import { decodeVin } from "../../lib/vin";

const D = (n: number) => new Prisma.Decimal(n);
const optStr = z.string().trim().max(1000).optional().transform((v) => v || null);
const optInt = z.coerce.number().int().nonnegative().optional().nullable();
const optMoney = z.coerce.number().nonnegative().optional().nullable();
const optDate = z.coerce.date().optional().nullable();
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);
const reqNum = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).nonnegative(`${label} can't be negative`),
  );
const reqInt = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).nonnegative(`${label} can't be negative`),
  );

/**
 * Add New Vehicle. Required = the validators that are switched on in the live form:
 * Assigned ID, Original/Current Odometer, Make, Model, Colour, Type, Tank Size, Maintenance Every Km,
 * Insurance Amount, Inspection Amount, License Number, LDW (Monthly Rate). Locations are required
 * but default to the working location.
 */
export const vehicleInput = z
  .object({
    // Identity / spec
    assignedId: req("Assigned ID"),
    name: optStr,
    spotNumber: optStr,
    makeId: req("Make"),
    modelId: req("Model"),
    modelCode: optStr,
    year: z.coerce.number().int().min(1920).max(2100).optional().nullable(),
    colour: req("Colour"),
    doors: optInt,
    cylinders: optInt,
    engine: optStr,
    horsepower: optInt,
    seats: optInt,
    transmission: z.enum(["NONE", "AUTOMATIC", "MANUAL", "TIPTRONIC"]).optional().nullable(),
    vehicleTypeId: req("Type"),
    vin: optStr,
    memo: optStr,
    // Operations
    rentalLocationId: req("Rental location"),
    owningLocationId: req("Owning location"),
    currentLocationId: req("Current location"),
    status: z.enum(VEHICLE_STATUS_VALUES).default("AVAILABLE"),
    categoryId: optStr,
    bodyId: optStr,
    fuelTypeId: optStr,
    tankSize: reqInt("Tank size"),
    fuelLevel: z.coerce.number().int().min(0).max(16).default(16),
    originalOdometer: reqInt("Original odometer"),
    currentOdometer: reqInt("Current odometer"),
    keyNumber: optStr,
    isExclusiveFleet: z.boolean().default(false),
    isActive: z.boolean().default(true),
    // Maintenance / insurance / licensing
    maintenanceBeginOdometer: optInt,
    maintenanceBeginDate: optDate,
    maintenanceEveryKm: reqInt("Maintenance every km"),
    insuranceAmount: reqNum("Insurance amount"),
    inspectionDate: optDate,
    inspectionAmount: reqNum("Inspection amount"),
    licenseNumber: req("License number"),
    licenseProvince: optStr,
    licenseAmount: optMoney,
    licenseFirstRegistered: optDate,
    licenseExpiry: optDate,
    ldwMonthlyRate: reqNum("LDW monthly rate"),
    // Mechanical
    powerTrain: z.enum(["FOUR_BY_TWO", "FOUR_BY_FOUR"]).optional().nullable(),
    fuelGrade: optStr,
    oilType: optStr,
    dimensions: optStr,
    maxPayload: optStr,
    verticalClearance: optStr,
    frontTirePressure: optStr,
    rearTirePressure: optStr,
    engineBrandId: optStr,
    engineTypeId: optStr,
    gvwr: optStr,
    cityMpg: optMoney,
    highwayMpg: optMoney,
    // Appearance & pricing
    interiorColor: optStr,
    interiorRgb: optStr,
    exteriorRgb: optStr,
    stereo: optStr,
    subscriptionPlanId: optStr,
    monthlyPlanId: optStr,
    yearlyPlanId: optStr,
    weeklyLowMileagePlanId: optStr,
    weeklyHighMileagePlanId: optStr,
    monthlyLowMileagePlanId: optStr,
    monthlyHighMileagePlanId: optStr,
    marketingDescription: optStr,
    retailPriceLow: optMoney,
    retailPriceHigh: optMoney,
    optionIds: z.array(z.string()).default([]),
    // GPS — manual until Moovetrax
    gpsTrackerId: optStr,
    gpsLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    gpsLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.currentOdometer < v.originalOdometer)
      ctx.addIssue({ code: "custom", path: ["currentOdometer"], message: "Current odometer can't be below the original odometer" });
    if (v.retailPriceLow != null && v.retailPriceHigh != null && v.retailPriceHigh < v.retailPriceLow)
      ctx.addIssue({ code: "custom", path: ["retailPriceHigh"], message: "High price must be at least the low price" });
    if ((v.gpsLatitude == null) !== (v.gpsLongitude == null))
      ctx.addIssue({ code: "custom", path: ["gpsLongitude"], message: "Enter both latitude and longitude" });
  });

const decimalOrNull = (v: number | null | undefined) => (v == null ? null : D(v));

/** Form input → Vehicle columns (money/decimal fields as Decimals). */
function vehicleData(input: z.infer<typeof vehicleInput>) {
  const { optionIds, insuranceAmount, inspectionAmount, licenseAmount, ldwMonthlyRate, cityMpg, highwayMpg, retailPriceLow, retailPriceHigh, gpsLatitude, gpsLongitude, ...rest } = input;
  return {
    optionIds,
    data: {
      ...rest,
      insuranceAmount: D(insuranceAmount),
      inspectionAmount: D(inspectionAmount),
      licenseAmount: decimalOrNull(licenseAmount),
      ldwMonthlyRate: D(ldwMonthlyRate),
      cityMpg: decimalOrNull(cityMpg),
      highwayMpg: decimalOrNull(highwayMpg),
      retailPriceLow: decimalOrNull(retailPriceLow),
      retailPriceHigh: decimalOrNull(retailPriceHigh),
      gpsLatitude: decimalOrNull(gpsLatitude),
      gpsLongitude: decimalOrNull(gpsLongitude),
    },
  };
}

async function checkModel(prisma: Prisma.TransactionClient, makeId: string, modelId: string) {
  const model = await prisma.vehicleModel.findUnique({ where: { id: modelId } });
  if (!model || model.makeId !== makeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Model doesn't belong to the selected make." });
}

function uniqueError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const field = String((e.meta?.target as string[] | undefined)?.[0] ?? "");
    throw new TRPCError({ code: "CONFLICT", message: `Another vehicle already has this ${field === "vin" ? "VIN" : "Assigned ID"}.` });
  }
  throw e;
}

/**
 * Standard specs every unit of the same year / make / model shares (client request, Nov 17): copied from the newest
 * unit of that model when a vehicle is added, so only what differs (engine, options) is typed. Not identity, plate,
 * colour, odometer, location or money.
 */
const SPEC_FIELDS = [
  "modelCode", "doors", "cylinders", "engine", "horsepower", "seats", "transmission", "vehicleTypeId", "categoryId", "bodyId", "fuelTypeId", "tankSize",
  "maintenanceEveryKm", "powerTrain", "fuelGrade", "oilType", "dimensions", "maxPayload", "verticalClearance", "frontTirePressure", "rearTirePressure",
  "engineBrandId", "engineTypeId", "gvwr", "cityMpg", "highwayMpg",
] as const;

/** A lookup (fuel type, body…) whose name matches one of the words vPIC gave, e.g. "Gasoline" → "Gas". */
async function matchLookup(db: Prisma.TransactionClient, kind: "FUEL_TYPE" | "VEHICLE_BODY", text: string | null, synonyms: Record<string, string[]>) {
  if (!text) return null;
  const all = await db.lookup.findMany({ where: { kind, isActive: true }, select: { id: true, name: true } });
  const t = text.toLowerCase();
  const exact = all.find((l) => l.name.toLowerCase() === t);
  if (exact) return exact.id;
  for (const [k, words] of Object.entries(synonyms)) if (words.some((w) => t.includes(w))) {
    const hit = all.find((l) => l.name.toLowerCase().includes(k));
    if (hit) return hit.id;
  }
  return all.find((l) => t.includes(l.name.toLowerCase()))?.id ?? null;
}

export const vehicleRouter = router({
  /**
   * Add New Vehicle → VIN: year, make, model, engine and standard specs from NHTSA vPIC (live), matched to this
   * system's makes / models / fuel types / bodies where they exist.
   */
  decodeVin: staffProcedure.input(z.object({ vin: z.string() })).mutation(async ({ ctx, input }) => {
    const v = await decodeVin(input.vin);
    const make = v.make ? await ctx.prisma.vehicleMake.findFirst({ where: { name: { equals: v.make, mode: "insensitive" } }, select: { id: true, name: true } }) : null;
    const model = make && v.model ? await ctx.prisma.vehicleModel.findFirst({ where: { makeId: make.id, name: { equals: v.model, mode: "insensitive" } }, select: { id: true, name: true } }) : null;
    const fuelTypeId = await matchLookup(ctx.prisma, "FUEL_TYPE", v.fuel, { gas: ["gasoline", "petrol", "flex"], diesel: ["diesel"], electric: ["electric"], hybrid: ["hybrid"] });
    const bodyId = await matchLookup(ctx.prisma, "VEHICLE_BODY", v.body, { suv: ["sport utility", "suv", "crossover"], minivan: ["minivan"], van: ["van"], truck: ["pickup", "truck"], car: ["sedan", "saloon", "coupe", "hatchback", "convertible", "wagon"] });
    return { ...v, makeId: make?.id ?? null, makeName: make?.name ?? v.make, modelId: model?.id ?? null, modelName: model?.name ?? v.model, fuelTypeId, bodyId };
  }),

  /** The VIN's make / model when this system doesn't have them yet (Vehicle Setup > Makes & Models gets them too). */
  ensureMakeModel: permitted("VehiclesAdd")
    .input(z.object({ make: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const make =
        (await ctx.prisma.vehicleMake.findFirst({ where: { name: { equals: input.make, mode: "insensitive" } } })) ?? (await ctx.prisma.vehicleMake.create({ data: { name: input.make } }));
      const model =
        (await ctx.prisma.vehicleModel.findFirst({ where: { makeId: make.id, name: { equals: input.model, mode: "insensitive" } } })) ??
        (await ctx.prisma.vehicleModel.create({ data: { makeId: make.id, name: input.model } }));
      return { makeId: make.id, modelId: model.id };
    }),

  /** Standard specs from the newest unit of the same model (same year first, else the nearest year). */
  specTemplate: staffProcedure
    .input(z.object({ modelId: z.string().min(1), year: z.coerce.number().int().optional().nullable(), excludeId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const units = await ctx.prisma.vehicle.findMany({
        where: { modelId: input.modelId, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: { make: { select: { name: true } }, model: { select: { name: true } }, options: { select: { optionId: true } } },
      });
      if (!units.length) return null;
      const pick = input.year
        ? [...units].sort((a, b) => Math.abs((a.year ?? 0) - input.year!) - Math.abs((b.year ?? 0) - input.year!))[0]!
        : units[0]!;
      const values: Record<string, string> = {};
      for (const f of SPEC_FIELDS) {
        const x = (pick as Record<string, unknown>)[f];
        if (x != null && x !== "") values[f] = String(x);
      }
      return {
        from: `${pick.year ?? ""} ${pick.make.name} ${pick.model.name}`.trim() + ` — unit ${pick.assignedId}`,
        sameYear: !input.year || pick.year === input.year,
        values,
        optionIds: pick.options.map((o) => o.optionId),
      };
    }),


  formOptions: staffProcedure.query(async ({ ctx }) => {
    const [makes, vehicleTypes, locations, lookups] = await Promise.all([
      ctx.prisma.vehicleMake.findMany({ orderBy: { name: "asc" }, include: { models: { orderBy: { name: "asc" }, select: { id: true, name: true } } } }),
      ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.location.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
      ctx.prisma.lookup.findMany({
        where: { isActive: true, kind: { in: ["VEHICLE_CATEGORY", "VEHICLE_BODY", "FUEL_TYPE", "ENGINE_BRAND", "ENGINE_TYPE", "VEHICLE_OPTION"] } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, kind: true, name: true },
      }),
    ]);
    const of = (kind: string) => lookups.filter((l) => l.kind === kind).map(({ id, name }) => ({ id, name }));
    return {
      makes,
      vehicleTypes,
      locations: locations.map((l) => ({ id: l.id, name: l.isActive ? l.name : `${l.name} (inactive)` })),
      categories: of("VEHICLE_CATEGORY"),
      bodies: of("VEHICLE_BODY"),
      fuelTypes: of("FUEL_TYPE"),
      engineBrands: of("ENGINE_BRAND"),
      engineTypes: of("ENGINE_TYPE"),
      options: of("VEHICLE_OPTION"),
    };
  }),

  create: permitted("VehiclesAdd").input(vehicleInput).mutation(async ({ ctx, input }) => {
    await checkModel(ctx.prisma, input.makeId, input.modelId);
    const { optionIds, data } = vehicleData(input);
    try {
      const v = await ctx.prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.create({
          data: { ...data, gpsUpdatedAt: data.gpsLatitude ? new Date() : null, options: { create: optionIds.map((optionId) => ({ optionId })) } },
        });
        await audit(tx, "Vehicle", v.id, ctx.user.id, { Created: [null, v.assignedId] });
        return v;
      });
      return { id: v.id };
    } catch (e) {
      uniqueError(e);
    }
  }),

  /** Edit Vehicle (legacy VehicleSpecs.aspx): same fields as Add; every changed field is written to the audit log. */
  update: permitted("VehiclesEdit").input(z.object({ vehicleId: z.string(), data: vehicleInput })).mutation(async ({ ctx, input }) => {
    const before = await ctx.prisma.vehicle.findUnique({ where: { id: input.vehicleId }, include: { options: { select: { optionId: true } } } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
    await checkModel(ctx.prisma, input.data.makeId, input.data.modelId);
    const { optionIds, data } = vehicleData(input.data);
    const gpsMoved = String(before.gpsLatitude ?? "") !== String(data.gpsLatitude ?? "") || String(before.gpsLongitude ?? "") !== String(data.gpsLongitude ?? "");
    try {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.vehicle.update({
          where: { id: before.id },
          data: {
            ...data,
            ...(gpsMoved ? { gpsUpdatedAt: data.gpsLatitude ? new Date() : null } : {}),
            options: { deleteMany: {}, create: optionIds.map((optionId) => ({ optionId })) },
          },
        });
        const changes: Record<string, [unknown, unknown]> = Object.fromEntries(
          Object.entries(data).map(([k, after]) => [k, [(before as Record<string, unknown>)[k], after]]),
        );
        const oldOptions = before.options.map((o) => o.optionId).sort().join(",");
        changes.options = [oldOptions, [...optionIds].sort().join(",")];
        await audit(tx, "Vehicle", before.id, ctx.user.id, changes);
      });
    } catch (e) {
      uniqueError(e);
    }
    return { id: before.id };
  }),

  list: permitted("Vehicles")
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(VEHICLE_STATUS_VALUES).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.search?.trim();
      const where: Prisma.VehicleWhereInput = {
        isActive: true,
        status: input.status,
        ...(q
          ? {
              OR: [
                { assignedId: { contains: q, mode: "insensitive" } },
                { licenseNumber: { contains: q, mode: "insensitive" } },
                { vin: { contains: q, mode: "insensitive" } },
                { make: { name: { contains: q, mode: "insensitive" } } },
                { model: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      };
      const now = new Date();
      const [total, rows] = await Promise.all([
        ctx.prisma.vehicle.count({ where }),
        ctx.prisma.vehicle.findMany({
          where,
          orderBy: { assignedId: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            assignedId: true,
            licenseNumber: true,
            status: true,
            year: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
            vehicleType: { select: { name: true, imageKey: true } },
            currentLocation: { select: { name: true } },
            owningLocation: { select: { name: true } },
            _count: { select: { blocks: { where: { reservationId: { not: null }, startsAt: { gt: now } } } } },
          },
        }),
      ]);
      return { total, rows };
    }),

  byId: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const v = await ctx.prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      include: {
        make: true,
        model: true,
        vehicleType: true,
        rentalLocation: { select: { name: true } },
        owningLocation: { select: { name: true } },
        currentLocation: { select: { name: true } },
        category: true,
        body: true,
        fuelType: true,
        engineBrand: true,
        engineType: true,
        options: { include: { option: true } },
      },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
    return v;
  }),
});
