/**
 * The real fleet copied read-only from RentCentric (Vehicles list + VehicleSpecs.aspx edit form per vehicle)
 * into prisma/legacy/vehicles.json. Upserts by legacyId. Seed/test vehicles (no legacyId) are deactivated
 * so only the real fleet shows; their test bookings stay intact.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-vehicles.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma, type LookupKind, type VehicleStatus } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string, string | boolean | null | string[]> & { legacyId: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() && !/^(please select|select|\.|exterior color rgb|interior rgb)$/i.test(v.trim()) ? v.trim() : null);
const int = (v: unknown) => {
  const n = parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
const dec = (v: unknown) => {
  const s = String(v ?? "").replace(/[^0-9.-]/g, "");
  return s && Number(s) !== 0 ? new Prisma.Decimal(s) : null;
};
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);

const LOCATION_BY_NAME: [RegExp, string][] = [
  [/YYC|Calgary/i, "loc_yyc"],
  [/Surrey/i, "loc_surrey"],
  [/Coquitlam/i, "loc_coquitlam"],
  [/Richmond/i, "loc_richmond"],
  [/Burnaby/i, "loc_burnaby"],
  [/YVR/i, "loc_yvr"],
  [/Vancouver/i, "loc_vanAdmin"],
];
const loc = (v: unknown) => LOCATION_BY_NAME.find(([re]) => re.test(String(v ?? "")))?.[1] ?? null;

// legacy label → enum ("Hold for Sale" → HOLD_FOR_SALE; the ERP misspells "Out Of Sevices")
const status = (v: unknown) => String(v ?? "").trim().replace(/Sevices$/i, "Service").toUpperCase().replace(/\s+/g, "_") as VehicleStatus;
const TRANSMISSION: Record<string, "AUTOMATIC" | "MANUAL" | "TIPTRONIC" | "NONE"> = { Automatic: "AUTOMATIC", Manual: "MANUAL", "Tip Tronic": "TIPTRONIC", None: "NONE" };

async function lookup(kind: LookupKind, name: string | null) {
  if (!name) return null;
  const l = await prisma.lookup.upsert({ where: { kind_name: { kind, name } }, update: {}, create: { kind, name } });
  return l.id;
}

async function main() {
  const rows = JSON.parse(readFileSync(join(__dirname, "legacy/vehicles.json"), "utf8")) as Row[];
  let n = 0;
  const skipped: string[] = [];
  for (const r of rows) {
    const assignedId = str(r.AssignedID);
    const makeName = str(r.Make);
    const modelName = str(r.Model) ?? (Array.isArray(r.list) ? String(r.list[0]).replace(/^\S+\s+/, "").replace(/\s*\(.*$/, "") : null);
    const typeName = str(r.VehicleType) ?? (Array.isArray(r.list) ? String(r.list[2]) : null);
    const rentalLocationId = loc(r.LocationID) ?? loc(Array.isArray(r.list) ? r.list[4] : null);
    if (!assignedId || !makeName || !modelName || !typeName || !rentalLocationId) {
      skipped.push(`${r.legacyId}:${assignedId}`);
      continue;
    }
    const make = await prisma.vehicleMake.upsert({ where: { name: makeName }, update: {}, create: { name: makeName } });
    const model = await prisma.vehicleModel.upsert({ where: { makeId_name: { makeId: make.id, name: modelName } }, update: {}, create: { makeId: make.id, name: modelName } });
    const type = await prisma.vehicleType.upsert({ where: { name: typeName }, update: {}, create: { name: typeName } });

    const data = {
      isActive: r.IsActive !== false,
      assignedId,
      name: str(r.VehicleNameTxtbox),
      makeId: make.id,
      modelId: model.id,
      modelCode: str(r.ModelCodes),
      year: int(r.YearMade),
      colour: str(r.Colour) ?? "—",
      doors: int(r.Doors),
      cylinders: int(r.Cylinders),
      transmission: TRANSMISSION[String(r.Transmission)] ?? null,
      vehicleTypeId: type.id,
      vin: str(r.VINNumber),
      memo: str(r.Memo),
      rentalLocationId,
      owningLocationId: loc(r.OwningLocation) ?? rentalLocationId,
      currentLocationId: loc(r.CurrentLocation) ?? rentalLocationId,
      status: status(r.Status ?? "Available"),
      categoryId: await lookup("VEHICLE_CATEGORY", str(r.Category)),
      bodyId: await lookup("VEHICLE_BODY", str(r.BodyType)),
      fuelTypeId: await lookup("FUEL_TYPE", str(r.FuelType)),
      tankSize: int(r.TankSize) ?? 0,
      originalOdometer: int(r.OriginalOdometer),
      currentOdometer: int(r.Odometer),
      spotNumber: str(r.txtSpotNumber),
      keyNumber: str(r.KeyNumber),
      isExclusiveFleet: r.IsExclisiveFleetChkbx === true,
      maintenanceBeginOdometer: int(r.MaintenanceBeginOdometer),
      maintenanceBeginDate: day(r.MaintenanceBeginDate),
      maintenanceEveryKm: int(r.ServiceInterval) ?? 0,
      insuranceAmount: dec(r.InsuranceAmount) ?? new Prisma.Decimal(0),
      inspectionDate: day(r.InspectionDate),
      inspectionAmount: dec(r.InspectionAmount),
      licenseNumber: str(r.LicenseNumber) ?? "—",
      licenseProvince: str(r.LicenseState),
      licenseAmount: dec(r.LicenseAmount),
      licenseFirstRegistered: day(r.LicenseFirstRegistered),
      licenseExpiry: day(r.LicenseExpiryDate),
      ldwMonthlyRate: dec(r.LDW),
      powerTrain: r.PowerTrain === "4X4" ? ("FOUR_BY_FOUR" as const) : r.PowerTrain === "4X2" ? ("FOUR_BY_TWO" as const) : null,
      fuelGrade: str(r.FuelGrade),
      oilType: str(r.OilType),
      dimensions: str(r.Dimensions),
      maxPayload: int(r.txtMaximumPayload) ? String(int(r.txtMaximumPayload)) : null,
      verticalClearance: int(r.txtVerticalClearance) ? String(int(r.txtVerticalClearance)) : null,
      frontTirePressure: int(r.FrontPressure) ? String(r.FrontPressure) : null,
      rearTirePressure: int(r.RearPressure) ? String(r.RearPressure) : null,
      engineBrandId: await lookup("ENGINE_BRAND", str(r.EngineBrandLst)),
      engineTypeId: await lookup("ENGINE_TYPE", str(r.EngineTypeLst)),
      gvwr: int(r.txtGVWR) ? String(r.txtGVWR) : null,
      cityMpg: dec(r.txtCityMPG),
      highwayMpg: dec(r.txtHighwayMPG),
      interiorColor: str(r.txtInteriorColor),
      interiorRgb: str(r.txtInteriorRGB),
      exteriorRgb: str(r.txtExteriorColorRGB),
      stereo: str(r.txtStereo),
      subscriptionPlanId: str(r.txtSubscriptionPlanID),
      monthlyPlanId: str(r.txtMonthlyPlanID),
      yearlyPlanId: str(r.txtYearlyPlanID),
      weeklyLowMileagePlanId: str(r.txtWeeklyLowMilagePlanID),
      weeklyHighMileagePlanId: str(r.txtWeeklyHighMilagePlanID),
      monthlyLowMileagePlanId: str(r.txtMonthlyLowMilagePlanID),
      monthlyHighMileagePlanId: str(r.txtMonthlyHighMilagePlanID),
      marketingDescription: str(r.txtMarketingDesription),
      retailPriceLow: dec(r.txtRetailPriceLow),
      retailPriceHigh: dec(r.txtRetailPriceHigh),
    };
    const legacyId = Number(r.legacyId);
    // a seed vehicle may already use the same unit number / VIN — the real record wins
    await prisma.vehicle.updateMany({ where: { legacyId: null, OR: [{ assignedId }, ...(data.vin ? [{ vin: data.vin }] : [])] }, data: { assignedId: `TEST-${assignedId}`, vin: null } });
    await prisma.vehicle.upsert({ where: { legacyId }, update: data, create: { ...data, legacyId } });
    n++;
  }
  const off = await prisma.vehicle.updateMany({ where: { legacyId: null, isActive: true }, data: { isActive: false } });
  console.log(`Imported ${n} vehicles; deactivated ${off.count} test vehicles.${skipped.length ? ` Skipped: ${skipped.join(", ")}` : ""}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
