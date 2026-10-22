import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, permitted } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Settings > Import Data and Other Tools: Customer / Company / Rate / Referral / Vehicle / Model Import, reading
 * RentCentric's own CSV templates (CustomersUploads.csv, CompanyUpload.csv, RatesUploads.csv, ReferralImport,
 * VehiclesUploads.csv). The browser parses the CSV; rows arrive as { "<template column>": "value" }.
 * Card columns (CCType, CCNumber, CCExpMonth, CCExpYear) are ignored on purpose: card numbers are never stored here.
 * "Update Existing Records" updates a match (customer: email / licence #, company: code / name, rate: rate code + vehicle
 * type, referral: name, vehicle: vehicle ID, model: make + model) instead of skipping it.
 */

type Tx = Prisma.TransactionClient;
type Row = Record<string, string>;
type Result = { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

const v = (r: Row, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(r).find((x) => x.trim().toLowerCase() === k.toLowerCase());
    if (hit && r[hit]?.trim()) return r[hit]!.trim();
  }
  return null;
};
const int = (s: string | null) => (s && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, "")) ? Math.round(Number(s.replace(/,/g, ""))) : null);
const dec = (s: string | null) => (s && /^-?\d+(\.\d+)?$/.test(s.replace(/[$,]/g, "")) ? new Prisma.Decimal(s.replace(/[$,]/g, "")) : null);
const yes = (s: string | null) => !!s && /^(y|yes|true|1)$/i.test(s);
/** RentCentric dates are M/D/YYYY (sometimes with a time); also accepts YYYY-MM-DD. */
function date(s: string | null) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const d = m ? new Date(Date.UTC(+m[3]!, +m[1]! - 1, +m[2]!)) : /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${s.slice(0, 10)}T00:00:00Z`) : null;
  return d && !Number.isNaN(+d) ? d : null;
}
const STATUSES = ["ACCIDENT_REPLACEMENT", "AUCTION", "AVAILABLE", "COMPREHENSIVE", "FOR_SALE", "GROUNDED", "HAS_PROBLEM", "HOLD_FOR_SALE", "IN_CHECKOUT_PROCESS", "IN_REPAIR", "IN_SERVICE", "LEASED_REPLACEMENT", "ON_RENT", "OUT_OF_SERVICE", "SOLD", "STAFF", "STOLEN"] as const;
const status = (s: string | null) => {
  const k = (s ?? "").toUpperCase().replace(/[^A-Z]+/g, "_");
  return (STATUSES as readonly string[]).includes(k) ? (k as (typeof STATUSES)[number]) : "AVAILABLE";
};

async function lookup(tx: Tx, kind: "COMPANY_TYPE" | "FUEL_TYPE" | "VEHICLE_BODY", name: string | null) {
  if (!name) return null;
  const hit = await tx.lookup.findFirst({ where: { kind, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return hit?.id ?? (await tx.lookup.create({ data: { kind, name } })).id;
}
async function makeModel(tx: Tx, make: string, model: string) {
  const mk = (await tx.vehicleMake.findFirst({ where: { name: { equals: make, mode: "insensitive" } } })) ?? (await tx.vehicleMake.create({ data: { name: make } }));
  const md = (await tx.vehicleModel.findFirst({ where: { makeId: mk.id, name: { equals: model, mode: "insensitive" } } })) ?? (await tx.vehicleModel.create({ data: { makeId: mk.id, name: model } }));
  return { makeId: mk.id, modelId: md.id, createdModel: md.name === model };
}
const vehicleTypeId = async (tx: Tx, name: string | null) =>
  name ? ((await tx.vehicleType.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }))?.id ?? null) : null;

/** On "Update Existing Records", blank cells keep what the record already has. */
const filled = <T extends Record<string, unknown>>(data: T) => Object.fromEntries(Object.entries(data).filter(([, x]) => x !== null && x !== "")) as Partial<T>;

type Handler = (tx: Tx, r: Row, o: { update: boolean; locationId: string }) => Promise<"created" | "updated" | "skipped">;

const HANDLERS: Record<string, Handler> = {
  async customers(tx, r, o) {
    const firstName = v(r, "First Name"), lastName = v(r, "Last Name");
    if (!firstName || !lastName) throw new Error("First Name and Last Name are required");
    const email = v(r, "Email"), lic = v(r, "License Number");
    const data = {
      firstName, lastName, email, address1: v(r, "Address"), address2: v(r, "Address2"), city: v(r, "City"), province: v(r, "State"), postal: v(r, "Zip"),
      country: v(r, "Country"), phone: v(r, "Phone"), licenseNumber: lic, licenseExpiry: date(v(r, "License Exp")), licenseProvince: v(r, "License State"), birthDate: date(v(r, "date of birth", "Date Of Birth")),
    };
    const match = email || lic ? await tx.customer.findFirst({ where: { OR: [...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []), ...(lic ? [{ licenseNumber: lic }] : [])] }, select: { id: true } }) : null;
    if (match) {
      if (!o.update) return "skipped";
      await tx.customer.update({ where: { id: match.id }, data: filled(data) });
      return "updated";
    }
    await tx.customer.create({ data: { ...data, enteredLocationId: o.locationId, defaultLocationId: o.locationId, registrationChannel: "Import" } });
    return "created";
  },

  async companies(tx, r, o) {
    const name = v(r, "CompanyName");
    if (!name) throw new Error("CompanyName is required");
    const code = v(r, "CompanyCode");
    const data = {
      name, code, typeId: await lookup(tx, "COMPANY_TYPE", v(r, "CompanyType")), address1: v(r, "Address1"), address2: v(r, "Address2"), city: v(r, "City"), province: v(r, "State"),
      postal: v(r, "Zip"), country: v(r, "Country"), phone: v(r, "Phone"), fax: v(r, "Fax"), email: v(r, "Email"),
    };
    const match = await tx.company.findFirst({ where: code ? { code } : { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (match) {
      if (!o.update) return "skipped";
      await tx.company.update({ where: { id: match.id }, data: filled(data) });
      return "updated";
    }
    await tx.company.create({ data });
    return "created";
  },

  async referrals(tx, r, o) {
    const name = v(r, "Description");
    if (!name) throw new Error("Description is required");
    const data = { name, fullName: v(r, "FullName"), email: v(r, "Email"), phone: v(r, "Phone"), fax: v(r, "Fax"), memo: v(r, "Memo") };
    const match = await tx.referral.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (match) {
      if (!o.update) return "skipped";
      await tx.referral.update({ where: { id: match.id }, data: filled(data) });
      return "updated";
    }
    await tx.referral.create({ data });
    return "created";
  },

  async models(tx, r) {
    const make = v(r, "Make"), model = v(r, "Model");
    if (!make || !model) throw new Error("Make and Model are required");
    const before = await tx.vehicleModel.count({ where: { name: { equals: model, mode: "insensitive" }, make: { name: { equals: make, mode: "insensitive" } } } });
    await makeModel(tx, make, model);
    return before ? "skipped" : "created";
  },

  async vehicles(tx, r, o) {
    const assignedId = v(r, "VehicleID"), make = v(r, "Make"), model = v(r, "Model");
    if (!assignedId || !make || !model) throw new Error("VehicleID, Make and Model are required");
    const typeId = await vehicleTypeId(tx, v(r, "VehicleType"));
    if (!typeId) throw new Error(`Vehicle type "${v(r, "VehicleType") ?? ""}" doesn't exist (Settings › Vehicle Types)`);
    const mm = await makeModel(tx, make, model);
    const tr = (v(r, "Transmission") ?? "").toUpperCase();
    const data = {
      makeId: mm.makeId, modelId: mm.modelId, vehicleTypeId: typeId, year: int(v(r, "Year")), vin: v(r, "VINNumber"), status: status(v(r, "Status")),
      currentOdometer: int(v(r, "Odometer")), originalOdometer: int(v(r, "OriginalOdometer")), colour: v(r, "Colour") ?? "", licenseNumber: v(r, "LicenseNumber") ?? "",
      licenseExpiry: date(v(r, "LicenseExpiry")), licenseProvince: v(r, "LicenseState"), tankSize: int(v(r, "TankSize")) ?? 0, memo: v(r, "Memo"), doors: int(v(r, "Doors")),
      fuelLevel: Math.min(16, Math.max(0, int(v(r, "FuelLevel")) ?? 16)), fuelTypeId: await lookup(tx, "FUEL_TYPE", v(r, "FuelType")),
      transmission: (["AUTOMATIC", "MANUAL", "TIPTRONIC"].includes(tr) ? tr : null) as "AUTOMATIC" | null, bodyId: await lookup(tx, "VEHICLE_BODY", v(r, "Body")),
      maintenanceEveryKm: int(v(r, "ServiceInterval")) ?? 0, isActive: v(r, "Active") == null ? true : yes(v(r, "Active")),
    };
    const match = await tx.vehicle.findFirst({ where: { assignedId: { equals: assignedId, mode: "insensitive" } }, select: { id: true } });
    if (match) {
      if (!o.update) return "skipped";
      await tx.vehicle.update({ where: { id: match.id }, data: filled(data) });
      return "updated";
    }
    await tx.vehicle.create({ data: { ...data, assignedId, rentalLocationId: o.locationId, owningLocationId: o.locationId, currentLocationId: o.locationId, insuranceAmount: new Prisma.Decimal(0) } });
    return "created";
  },

  async rates(tx, r, o) {
    const code = v(r, "RateCode");
    if (!code) throw new Error("RateCode is required");
    const typeId = await vehicleTypeId(tx, v(r, "VehicleType"));
    if (!typeId) throw new Error(`Vehicle type "${v(r, "VehicleType") ?? ""}" doesn't exist (Settings › Vehicle Types)`);
    const calc = (v(r, "CalculationType") ?? "").toLowerCase();
    const days = (v(r, "AvailableOn") ?? "").toLowerCase();
    const rate = {
      calculationBy: (calc.includes("calendar") ? "CALENDAR_DAY" : calc.includes("flat") ? "FLAT" : "HOUR_24") as "HOUR_24",
      rateType: v(r, "RateType") ?? "Standard", minDays: int(v(r, "MinDays")) ?? 0, maxDays: int(v(r, "MaxDays")) ?? 0, minHours: int(v(r, "MinHours")) ?? 0, maxHours: int(v(r, "MaxHours")) ?? 0,
      graceMinutes: int(v(r, "GraceMinutes")) ?? 0, minChargeDays: int(v(r, "MinimumRentalDays")) ?? 0, effectiveDate: date(v(r, "EffectiveDate")), endDate: date(v(r, "EndDate")),
      isActive: v(r, "IsActive") == null ? true : yes(v(r, "IsActive")), valuePricing: yes(v(r, "ValuePricing")), displayOnline: yes(v(r, "WebCustomer")), skipHourly: yes(v(r, "SkipOnStart")),
      availableDays: days ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => days.includes(d)) : [true, true, true, true, true, true, true],
      extraKmCharge: dec(v(r, "MileageCharge")) ?? new Prisma.Decimal(0),
    };
    const value = {
      hourly: dec(v(r, "HourlyRate")), daily: dec(v(r, "DailyRate")), extraDaily: dec(v(r, "ExtraDailyRate")), weekly: dec(v(r, "WeeklyRate")), monthly: dec(v(r, "MonthlyRate")),
      kmAllowed: int(v(r, "MileageAllowedDaily")), kmWeekly: int(v(r, "MileageAllowedWeekly")), kmMonthly: int(v(r, "MileageAllowedMonthly")),
    };
    const existing = await tx.rate.findUnique({ where: { locationId_code: { locationId: o.locationId, code } }, include: { values: { where: { vehicleTypeId: typeId, seasonId: null } } } });
    if (existing) {
      if (existing.values.length && !o.update) return "skipped";
      if (o.update) await tx.rate.update({ where: { id: existing.id }, data: filled(rate) });
      if (existing.values.length) await tx.rateValue.update({ where: { id: existing.values[0]!.id }, data: filled(value) });
      else await tx.rateValue.create({ data: { rateId: existing.id, vehicleTypeId: typeId, ...value } });
      return "updated";
    }
    await tx.rate.create({ data: { ...rate, code, locationId: o.locationId, fuelChargePerUnit: new Prisma.Decimal(0), values: { create: [{ vehicleTypeId: typeId, ...value }] } } });
    return "created";
  },
};

export const IMPORT_TYPES = ["customers", "companies", "rates", "referrals", "vehicles", "models"] as const;

export const importsRouter = router({
  run: permitted("Settings")
    .input(z.object({ type: z.enum(IMPORT_TYPES), locationId: z.string().min(1, "Choose the location"), update: z.boolean().default(false), rows: z.array(z.record(z.string(), z.string())).min(1, "The file has no rows").max(5000, "Up to 5,000 rows per import") }))
    .mutation(async ({ ctx, input }) => {
      const loc = await ctx.prisma.location.findUnique({ where: { id: input.locationId }, select: { id: true } });
      if (!loc) throw new TRPCError({ code: "BAD_REQUEST", message: "Location not found" });
      const res: Result = { created: 0, updated: 0, skipped: 0, errors: [] };
      // one row at a time, each in its own transaction: a bad row is reported and the rest still import
      for (const [i, r] of input.rows.entries()) {
        try {
          const outcome = await ctx.prisma.$transaction((tx) => HANDLERS[input.type]!(tx, r, { update: input.update, locationId: input.locationId }));
          res[outcome]++;
        } catch (e) {
          const msg = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? `Duplicate value (${(e.meta?.target as string[] | undefined)?.join(", ") ?? "unique field"})` : (e as Error).message;
          if (res.errors.length < 200) res.errors.push({ row: i + 2, message: msg.split("\n").pop()!.slice(0, 200) });
        }
      }
      await audit(ctx.prisma, "Import", input.type, ctx.user.id, { Import: [null, `${input.rows.length} rows: ${res.created} created, ${res.updated} updated, ${res.skipped} skipped, ${res.errors.length} errors`] });
      return res;
    }),
});
