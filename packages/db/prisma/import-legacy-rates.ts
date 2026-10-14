/**
 * Imports the real Master Rates copied (read-only) from RentCentric:
 *   - prisma/legacy/rates_<loc>.json   one object per RatesModifyNew2.aspx edit form (settings, seasons, weekdays)
 *   - rates_<loc>.json `vehicleRates`: the per-class Hourly/Daily/Extra/Weekly/Monthly + km + extra-km rows printed
 *     on the rate form itself (unrounded); stored for each of the rate's seasons (or season = null). Preferred.
 *   - prisma/legacy/ratecal_<loc>.json Rates Calendar snapshots { "YYYY-MM-DD": { names[], rows{ rowIndex: ["CODE: M $.., n KM, W $.., n KM, D $.., n KM, X $.., H $.."] } } }
 * Calendar values fill only what the form lacks. Values are stored per (rate, vehicle type, season) — the season containing each snapshot date —
 * or with season = null for date-range rates.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-rates.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma, type RateCalculation } from "@prisma/client";

const prisma = new PrismaClient();
const DIR = join(__dirname, "legacy");
const LOCATIONS: Record<string, string> = { "116": "loc_richmond", "117": "loc_burnaby", "118": "loc_vanAdmin", "120": "loc_yyc", "121": "loc_surrey", "126": "loc_yvr" };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

type VehicleRate = { type: string; checked: boolean; hourly: string | null; daily: string | null; extraDaily: string | null; weekly: string | null; monthly: string | null; kmDaily: string | null; kmWeekly: string | null; kmMonthly: string | null; extraKm: string | null };
type RateRow = Record<string, string | boolean | null | string[] | (boolean | null)[] | VehicleRate[]> & {
  id: string;
  seasons: string[];
  allSeasons: string[];
  days: (boolean | null)[];
  vehicleRates?: VehicleRate[];
};
type Snapshot = { names: string[]; rows: Record<string, string[]> };

const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : parseInt(String(v), 10) || 0);
const dec = (v: string | undefined | null) => (v ? new Prisma.Decimal(v.replace(/,/g, "")) : null);
const calc = (v: unknown): RateCalculation => (v === "Calender Day" ? "CALENDAR_DAY" : v === "Flat" ? "FLAT" : "HOUR_24");

/** "10_October (01 October - 01 November)" → { name, start, end } (year 2000 placeholder; only month/day matter) */
function parseSeason(label: string) {
  const m = label.match(/^(.*?)\s*\((\d{1,2}) (\w+) - (\d{1,2}) (\w+)\)\s*$/);
  if (!m) return null;
  const mi = (s: string) => MONTHS.indexOf(s.toLowerCase());
  const [, name, d1, m1, d2, m2] = m;
  if (mi(m1!) < 0 || mi(m2!) < 0) return null;
  return { name: name!.trim(), start: new Date(Date.UTC(2000, mi(m1!), Number(d1))), end: new Date(Date.UTC(2000, mi(m2!), Number(d2))) };
}

function inSeason(date: string, s: { start: Date; end: Date }) {
  const d = new Date(`${date}T12:00:00Z`);
  const x = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const a = (s.start.getUTCMonth() + 1) * 100 + s.start.getUTCDate();
  const b = (s.end.getUTCMonth() + 1) * 100 + s.end.getUTCDate();
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}

/** "CODE: M $1,547.30, 5000 KM, W $361.04, 2000 KM, D $51.58, 300 KM, X $67.05, H $18.05" */
function parseBar(t: string) {
  const m = t.match(/^(.*?):\s*M \$([\d,.]+), (\d+) KM, W \$([\d,.]+), (\d+) KM, D \$([\d,.]+), (\d+) KM, X \$([\d,.]+), H \$([\d,.]+)/);
  if (!m) return null;
  return { code: m[1]!.trim(), monthly: m[2]!, kmMonthly: Number(m[3]), weekly: m[4]!, kmWeekly: Number(m[5]), daily: m[6]!, kmDaily: Number(m[7]), extraDaily: m[8]!, hourly: m[9]! };
}

/** "Available On" weekdays → Sun..Sat booleans. The scrape stored the ticked day names in `types`. */
function weekdays(r: RateRow) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ticked = (r.types as string[] | undefined) ?? [];
  if (ticked.some((t) => names.includes(t))) return names.map((n) => ticked.includes(n));
  return [true, true, true, true, true, true, true];
}

async function main() {
  let rateCount = 0;
  let valueCount = 0;
  for (const [legacyLoc, locationId] of Object.entries(LOCATIONS)) {
    const ratesFile = join(DIR, `rates_${legacyLoc}.json`);
    if (!existsSync(ratesFile)) continue;
    const rates = JSON.parse(readFileSync(ratesFile, "utf8")) as RateRow[];

    // seasons (shared names across locations)
    const seasonByLabel = new Map<string, { id: string; start: Date; end: Date }>();
    for (const label of new Set(rates.flatMap((r) => r.allSeasons ?? []))) {
      const s = parseSeason(label);
      if (!s) continue;
      const saved = await prisma.season.upsert({ where: { name: s.name }, update: { startDate: s.start, endDate: s.end }, create: { name: s.name, startDate: s.start, endDate: s.end } });
      seasonByLabel.set(label, { id: saved.id, start: s.start, end: s.end });
    }

    const rateByCode = new Map<string, { id: string; validFor: "SEASON" | "DATE_RANGE"; seasons: { id: string; start: Date; end: Date }[] }>();
    for (const r of rates) {
      const code = String(r.txtDescription ?? "").trim();
      if (!code) continue;
      const validFor = r.ddlRateValidFor === "Season" ? "SEASON" : "DATE_RANGE";
      const data = {
        code,
        locationId,
        calculationBy: calc(r.ddlCalculationType),
        rateType: String(r.ddlRateType ?? "Standard"),
        validFor: validFor as "SEASON" | "DATE_RANGE",
        effectiveDate: typeof r.rdpEffectiveDate === "string" && /^\d{4}-/.test(r.rdpEffectiveDate) ? new Date(`${r.rdpEffectiveDate.slice(0, 10)}T00:00:00Z`) : null,
        endDate: typeof r.rdpEndDate === "string" && /^\d{4}-/.test(r.rdpEndDate) ? new Date(`${r.rdpEndDate.slice(0, 10)}T00:00:00Z`) : null,
        extraKmCharge: dec(String(r.txtKMExceed ?? "0")) ?? new Prisma.Decimal(0),
        graceMinutes: n(r.txtGraceMinutes),
        fuelChargePerUnit: dec(String(r.txtFuel ?? "0")) ?? new Prisma.Decimal(0),
        minChargeDays: n(r.txtMinRentalDays),
        minChargeHours: n(r.txtMinimumChargeHours) || null,
        skipHourly: r.cbSkipHourly === true,
        displayOnline: r.cbWebCustomer === true,
        valuePricing: r.ValuePricing === true,
        dateSpecific: r.CKDateSpecificRate === true,
        rentcarsCom: r.ckRentCars === true,
        isActive: r.cbActive === true,
        minDays: n(r.txtMinDays),
        minHours: n(r.DdlMinHours),
        minMinutes: n(r.DdlMinMinute),
        maxDays: n(r.txtMaxDays),
        maxHours: n(r.DdlMaxHours),
        maxMinutes: n(r.DdlMaxMinute),
        // legacy order Mon..Sun → ours Sun..Sat
        availableDays: weekdays(r),
      };
      const saved = await prisma.rate.upsert({ where: { legacyId: Number(r.id) }, update: data, create: { ...data, legacyId: Number(r.id) } });
      const seasons = (r.seasons ?? []).map((l) => seasonByLabel.get(l)).filter((s): s is NonNullable<typeof s> => !!s);
      await prisma.rateSeason.deleteMany({ where: { rateId: saved.id } });
      if (seasons.length) await prisma.rateSeason.createMany({ data: seasons.map((s) => ({ rateId: saved.id, seasonId: s.id })), skipDuplicates: true });
      rateByCode.set(code, { id: saved.id, validFor: data.validFor, seasons });
      rateCount++;
    }

    const types = new Map((await prisma.vehicleType.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
    const saveValue = async (rateId: string, vehicleTypeId: string, seasonId: string | null, data: Prisma.RateValueUncheckedCreateInput) => {
      const existing = await prisma.rateValue.findFirst({ where: { rateId, vehicleTypeId, seasonId } });
      if (existing) await prisma.rateValue.update({ where: { id: existing.id }, data });
      else await prisma.rateValue.create({ data: { ...data, rateId, vehicleTypeId, seasonId } });
      valueCount++;
    };

    // values printed on the rate form (same for every season the rate covers): exact, unrounded
    const fromForm = new Set<string>();
    for (const r of rates) {
      const rate = rateByCode.get(String(r.txtDescription ?? "").trim());
      if (!rate || !r.vehicleRates) continue;
      for (const v of r.vehicleRates) {
        const typeId = types.get(v.type);
        if (!typeId || !v.checked || !(Number(v.daily) > 0)) continue;
        const data = {
          rateId: rate.id, vehicleTypeId: typeId,
          hourly: dec(v.hourly), daily: dec(v.daily), extraDaily: dec(v.extraDaily), weekly: dec(v.weekly), monthly: dec(v.monthly),
          kmAllowed: n(v.kmDaily), kmWeekly: n(v.kmWeekly), kmMonthly: n(v.kmMonthly),
          // per-class extra km (0 is a real value: mrrentacar.com shows "Additional at $0.00")
          extraKmCharge: v.extraKm != null && v.extraKm !== "" ? dec(v.extraKm) : null,
        };
        for (const seasonId of rate.validFor === "SEASON" ? rate.seasons.map((s) => s.id) : [null]) {
          await saveValue(rate.id, typeId, seasonId, data);
          fromForm.add(`${rate.id}|${typeId}|${seasonId}`);
        }
      }
    }

    // Rates Calendar snapshots (rounded to cents): only fill prices the rate form didn't have
    // single-day snapshots (ratecal_) + snapshots with period lengths for Min/Max rates (ratecal2_, keys "date|days")
    const cal: Record<string, Snapshot> = {};
    for (const f of [`ratecal_${legacyLoc}.json`, `ratecal2_${legacyLoc}.json`]) {
      const path = join(DIR, f);
      if (existsSync(path)) Object.assign(cal, JSON.parse(readFileSync(path, "utf8")));
    }
    for (const [key, snap] of Object.entries(cal)) {
      const date = key.split("|")[0]!;
      for (const [idx, bars] of Object.entries(snap.rows ?? {})) {
        const typeId = types.get(snap.names[Number(idx)] ?? "");
        if (!typeId) continue;
        for (const t of bars) {
          const b = parseBar(t);
          const rate = b && rateByCode.get(b.code);
          if (!b || !rate) continue;
          const seasonId = rate.validFor === "SEASON" ? rate.seasons.find((s) => inSeason(date, s))?.id ?? null : null;
          if (rate.validFor === "SEASON" && !seasonId) continue;
          if (fromForm.has(`${rate.id}|${typeId}|${seasonId}`)) continue;
          await saveValue(rate.id, typeId, seasonId, {
            rateId: rate.id, vehicleTypeId: typeId,
            hourly: dec(b.hourly), daily: dec(b.daily), extraDaily: dec(b.extraDaily), weekly: dec(b.weekly), monthly: dec(b.monthly),
            kmAllowed: b.kmDaily, kmWeekly: b.kmWeekly, kmMonthly: b.kmMonthly,
          });
        }
      }
    }
  }
  // once real rates exist, the dev seed rate must not compete online
  if (rateCount) await prisma.rate.updateMany({ where: { legacyId: null }, data: { displayOnline: false } });
  console.log(`Imported ${rateCount} rates and ${valueCount} rate values.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
