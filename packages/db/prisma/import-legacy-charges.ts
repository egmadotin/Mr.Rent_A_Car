/**
 * Imports the real Misc Charges and Insurance Coverages copied (read-only) from RentCentric
 * Settings > Rates for each active location. Source files: prisma/legacy/{misc,ins}_<legacyLocationId>.json
 * (one object per edit form: MiscChargesModify.aspx / InsurancesModify.aspx field values).
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-charges.ts
 *
 * Idempotent: upserts by legacyId. If the same legacy id appears under several locations it is a
 * shared (all-location) charge in RentCentric and is stored with locationId = null.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma, type RateCalculation } from "@prisma/client";

const prisma = new PrismaClient();
const DIR = join(__dirname, "legacy");
const LOCATIONS: Record<string, string> = { "116": "loc_richmond", "117": "loc_burnaby", "118": "loc_vanAdmin", "119": "loc_coquitlam", "120": "loc_yyc", "121": "loc_surrey", "126": "loc_yvr" };

type Row = Record<string, string | boolean | null | string[]> & { id: string; types: string[] };

/** "1,000.00" → 1000; "(24.95)" → -24.95 (legacy shows credits in brackets). */
const D = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  const n = s.replace(/[^0-9.]/g, "") || "0";
  return new Prisma.Decimal(/^\s*\(|^\s*-/.test(s) ? `-${n}` : n);
};
const I = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : parseInt(String(v), 10) || 0);
const DT = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);
const B = (v: unknown) => v === true;
const S = (v: unknown) => (typeof v === "string" && v.trim() && !["Select", "Please Select"].includes(v.trim()) ? v.trim() : null);

function calc(v: unknown): RateCalculation {
  switch (v) {
    case "Percentage": return "PERCENT";
    case "Calender Day": return "CALENDAR_DAY";
    case "Flat": return "FLAT";
    default: return "HOUR_24";
  }
}

function load(prefix: string) {
  const byId = new Map<string, { row: Row; locs: string[] }>();
  for (const [legacyLoc, locId] of Object.entries(LOCATIONS)) {
    // misc2_/ins2_ = corrected re-copy (Rate field, groups, negatives); fall back to the first copy
    const f2 = join(DIR, `${prefix}2_${legacyLoc}.json`);
    const f = existsSync(f2) ? f2 : join(DIR, `${prefix}_${legacyLoc}.json`);
    if (!existsSync(f)) continue;
    for (const row of JSON.parse(readFileSync(f, "utf8")) as Row[]) {
      const e = byId.get(row.id);
      if (e) e.locs.push(locId);
      else byId.set(row.id, { row, locs: [locId] });
    }
  }
  return byId;
}

async function typeIds(names: string[]) {
  if (!names.length) return [];
  const types = await prisma.vehicleType.findMany({ where: { name: { in: names } }, select: { id: true } });
  return types.map((t) => t.id);
}

async function main() {
  const misc = load("misc");
  for (const { row: r, locs } of misc.values()) {
    const all = B(r.ChkAllVehicleTypes);
    const data = {
      locationId: locs.length === 1 ? locs[0]! : null,
      name: S(r.MiscChargeName) ?? `Charge ${r.id}`,
      code: S(r.MiscChargeCode) ?? "",
      calculationBy: calc(r.CalculationTypeDropDownList),
      // percentage charges keep their % in the Basic tab "Rate" field
      rate: (["PERCENT", "FLAT"].includes(calc(r.CalculationTypeDropDownList)) ? D(r.Rate) ?? D(r.BasicDailyRate) : D(r.BasicDailyRate) ?? D(r.Rate)) ?? new Prisma.Decimal(0),
      hourlyRate: D(r.HourlyRate),
      weeklyRate: D(r.BasicWeeklyRate),
      monthlyRate: D(r.BasicMonthlyRate),
      extraDailyRate: D(r.ExtraDailyRate),
      graceMinutes: I(r.GraceMinutes),
      milesIncluded: I(r.MilesIncluded),
      effectiveDate: DT(r.EffectiveDate),
      endDate: DT(r.EndDate),
      minDays: I(r.txtMinDays),
      maxDays: I(r.txtMaxDays),
      group: S(r.DDLGroups),
      description: S(r.txtMemo),
      allVehicleTypes: all,
      displayOnline: B(r.WebCustomer),
      rentcarsCom: B(r.ckRentCars),
      defaultRentcarsCom: B(r.ckDefaultRentCars),
      isMandatory: B(r.CKIsMandatory),
      isDefault: B(r.CheckBoxIsDefault),
      valuePricing: B(r.ValuePricing),
      autoWhenUnderAge: B(r.ChkBoxUnderAge),
      autoWhenAdditionalDriver: B(r.ChkBoxAdditionalDriver),
      isPrepaidFuel: B(r.CheckboxPrepaidFuel),
      isNoShowCharge: B(r.cbNoShowCharge),
      multiSelectOnline: B(r.ChkMultiSelectionOnline),
      displayAtStartRental: B(r.DisplayAtStartRental),
      displayAtEndRental: B(r.DisplayAtEndRental),
      tollAdminFeeWaiver: B(r.TollAdminFeeWaiver),
      isActive: B(r.IsActive),
    };
    const legacyId = Number(r.id);
    // adopt a seed row with the same name that has no legacy id yet (keeps existing charge-line links)
    const existing =
      (await prisma.miscCharge.findUnique({ where: { legacyId } })) ??
      (await prisma.miscCharge.findFirst({ where: { legacyId: null, name: data.name } }));
    const saved = existing
      ? await prisma.miscCharge.update({ where: { id: existing.id }, data: { ...data, legacyId } })
      : await prisma.miscCharge.create({ data: { ...data, legacyId } });
    await prisma.miscChargeVehicleType.deleteMany({ where: { miscChargeId: saved.id } });
    if (!all) {
      const ids = await typeIds(r.types ?? []);
      if (ids.length) await prisma.miscChargeVehicleType.createMany({ data: ids.map((vehicleTypeId) => ({ miscChargeId: saved.id, vehicleTypeId })) });
    }
  }

  const ins = load("ins");
  for (const { row: r, locs } of ins.values()) {
    const all = B(r.ChkAllVehicleTypes);
    const data = {
      locationId: locs.length === 1 ? locs[0]! : null,
      name: S(r.InsuranceName) ?? `Coverage ${r.id}`,
      code: S(r.InsuranceCode) ?? "",
      calculationBy: calc(r.CalculationTypeDropDownList),
      hourlyRate: D(r.HourlyRate),
      dailyRate: D(r.BasicDailyRate) ?? D(r.Rate) ?? new Prisma.Decimal(0),
      weeklyRate: D(r.BasicWeeklyRate),
      monthlyRate: D(r.BasicMonthlyRate),
      extraDailyRate: D(r.ExtraDailyRate),
      deductible: D(r.Deductible),
      graceMinutes: I(r.GraceMinutes),
      effectiveDate: DT(r.EffectiveDate),
      endDate: DT(r.EndDate),
      minDays: I(r.txtMinDays),
      maxDays: I(r.txtMaxDays),
      group: S(r.DDLGroups),
      description: S(r.txtMemo),
      allVehicleTypes: all,
      displayOnline: B(r.WebCustomer),
      rentcarsCom: B(r.ckRentCars),
      defaultRentcarsCom: B(r.ckDefaultRentCars),
      valuePricing: B(r.ValuePricing),
      isDeposit: B(r.CheckBoxIsDisposit),
      isDefault: B(r.CheckBoxIsDefault),
      isActive: B(r.IsActive),
    };
    const legacyId = Number(r.id);
    const saved = await prisma.insurance.upsert({ where: { legacyId }, update: data, create: { ...data, legacyId } });
    await prisma.insuranceVehicleType.deleteMany({ where: { insuranceId: saved.id } });
    if (!all) {
      const ids = await typeIds(r.types ?? []);
      if (ids.length) await prisma.insuranceVehicleType.createMany({ data: ids.map((vehicleTypeId) => ({ insuranceId: saved.id, vehicleTypeId })) });
    }
  }

  // seed-only rows (no legacy id) are superseded by the real catalogue
  if (misc.size) await prisma.miscCharge.updateMany({ where: { legacyId: null }, data: { isActive: false, displayOnline: false, isDefault: false } });
  console.log(`Imported ${misc.size} misc charges and ${ins.size} insurance coverages.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
