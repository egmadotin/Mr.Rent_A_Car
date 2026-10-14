import { Prisma } from "@mrac/db";
import { BUSINESS_TZ, localDateAsUtc, monthDayIn, weekdayIn } from "./tz";

type Tx = Prisma.TransactionClient;
const D = (n: number | Prisma.Decimal) => new Prisma.Decimal(n);
const ZERO = D(0);

export type ChargeDraft = {
  kind: "TIME" | "MILEAGE" | "DISCOUNT" | "PROTECTION" | "MISC" | "OTHER" | "TAX";
  name: string;
  units: Prisma.Decimal;
  rate: Prisma.Decimal;
  total: Prisma.Decimal;
  miscChargeId?: string | null;
  insuranceId?: string | null;
  taxId?: string | null;
  sortOrder: number;
};

export type PricingInput = {
  pickupAt: Date;
  returnAt: Date;
  /** location whose taxes apply (pickup location) */
  locationId: string;
  vehicleTypeId: string;
  rateId?: string | null;
  discountType?: "PERCENT" | "AMOUNT" | null;
  discountValue?: number | null;
  miscCharges?: { miscChargeId: string; quantity: number }[];
  /** chosen protection (Insurance). Omitted = the location's "Default Insurance", if any. */
  insuranceId?: string | null;
  /** staff options grid: every ticked insurance (several allowed, as in RentCentric). Overrides insuranceId/default. */
  insuranceIds?: string[];
  /** taxes unticked in the staff options grid */
  excludedTaxIds?: string[];
  /** legacy "Add/Edit Other Charges" (up to 4 free lines) */
  otherCharges?: { amount: number; description?: string | null; detail?: string | null }[];
  /** add the location's "Default MiscCharge" items automatically (RentCentric behaviour). Default true. */
  includeDefaults?: boolean;
  /** primary driver's age — adds the matching "Driver is underage" charge when under 25 */
  driverAge?: number | null;
  /** number of additional drivers — adds the "Additional Driver is added" charge × count */
  additionalDrivers?: number;
};

/**
 * Price a per-period charge (misc charge or protection) for a rental of `days`.
 * Value pricing = cheapest mix of monthly (30d) / weekly (7d) / daily, as RentCentric does.
 */
export function periodTotal(
  c: { rate: Prisma.Decimal; weeklyRate?: Prisma.Decimal | null; monthlyRate?: Prisma.Decimal | null; valuePricing: boolean },
  days: number,
) {
  const daily = Number(c.rate);
  const flat = daily * days;
  if (!c.valuePricing) return D(flat);
  const w = c.weeklyRate ? Number(c.weeklyRate) : null;
  const m = c.monthlyRate ? Number(c.monthlyRate) : null;
  let best = flat;
  for (let months = 0; months <= Math.floor(days / 30); months++) {
    if (months && m === null) break;
    const afterM = days - months * 30;
    for (let weeks = 0; weeks <= Math.ceil(afterM / 7); weeks++) {
      if (weeks && w === null) break;
      const rest = Math.max(0, afterM - weeks * 7);
      best = Math.min(best, months * (m ?? 0) + weeks * (w ?? 0) + rest * daily);
    }
  }
  return D(best);
}

/** IANA time zone of a location (bookings are location wall-clock time). */
export async function locationTz(tx: Tx, locationId: string) {
  const l = await tx.location.findUnique({ where: { id: locationId }, select: { timeZone: true } });
  return l?.timeZone ?? BUSINESS_TZ;
}

/** Seasons (month/day windows, any year) containing a date (in the location's zone). Handles windows that wrap the new year. */
export async function seasonsAt(tx: Tx, at: Date, tz: string = BUSINESS_TZ) {
  const md = (d: Date) => (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const { month, day } = monthDayIn(at, tz);
  const x = month * 100 + day;
  const seasons = await tx.season.findMany({ select: { id: true, startDate: true, endDate: true } });
  return seasons
    .filter((s) => {
      const a = md(s.startDate);
      const b = md(s.endDate);
      return a <= b ? x >= a && x <= b : x >= a || x <= b;
    })
    .map((s) => s.id);
}

/**
 * The online rate RentCentric would use: active + "Display Online" at the location, with a price for the
 * vehicle type in the pickup date's season (or a date-range rate covering it), available on the pickup
 * weekday, and whose Min/Max length fits the rental. Among matches, the most specific (highest minimum) wins.
 */
export async function pickOnlineRate(tx: Tx, input: { locationId: string; vehicleTypeId: string; pickupAt: Date; returnAt: Date }) {
  const tz = await locationTz(tx, input.locationId);
  const seasonIds = await seasonsAt(tx, input.pickupAt, tz);
  const day = localDateAsUtc(input.pickupAt, tz);
  const rates = await tx.rate.findMany({
    where: {
      locationId: input.locationId,
      isActive: true,
      displayOnline: true,
      values: { some: { vehicleTypeId: input.vehicleTypeId, OR: [{ seasonId: { in: seasonIds } }, { seasonId: null }] } },
      OR: [{ validFor: "SEASON" }, { AND: [{ OR: [{ effectiveDate: null }, { effectiveDate: { lte: day } }] }, { OR: [{ endDate: null }, { endDate: { gte: day } }] }] }],
    },
    include: { values: { where: { vehicleTypeId: input.vehicleTypeId } } },
  });
  const minutes = (+input.returnAt - +input.pickupAt) / 60_000;
  const weekday = weekdayIn(input.pickupAt, tz);
  const len = (d: number, h: number, m: number) => d * 1440 + h * 60 + m;
  const fits = rates.filter((r) => {
    if (r.availableDays.length === 7 && !r.availableDays[weekday]) return false;
    const min = len(r.minDays, r.minHours, r.minMinutes);
    const max = len(r.maxDays, r.maxHours, r.maxMinutes);
    if (r.validFor === "SEASON" && !r.values.some((v) => v.seasonId && seasonIds.includes(v.seasonId))) return false;
    return minutes >= min && (max === 0 || minutes <= max);
  });
  fits.sort((a, b) => len(b.minDays, b.minHours, b.minMinutes) - len(a.minDays, a.minHours, a.minMinutes) || a.code.localeCompare(b.code));
  return fits[0] ?? null;
}

/**
 * Per-period charge for a rental of `fullDays` + `remHours`, the way RentCentric prices options:
 * full days at the daily rate (value pricing applies), leftover hours prorated (see below) and capped at
 * one day; without an hourly rate a part day counts as a full day.
 */
export function chargeForPeriod(
  c: { rate: Prisma.Decimal; hourlyRate?: Prisma.Decimal | null; weeklyRate?: Prisma.Decimal | null; monthlyRate?: Prisma.Decimal | null; valuePricing: boolean },
  fullDays: number,
  remHours: number,
) {
  // RentCentric prorates part days at round(daily / 24, 2) per hour (verified: ODW Standard (SF) $33.95/day,
  // 30-hour rental → 33.95 + 6 × 1.41 = $42.41). Charges without an hourly rate round up to a full day.
  const hasHourly = !!c.hourlyRate && Number(c.hourlyRate) > 0;
  if (remHours > 0 && hasHourly) {
    const perHour = c.rate.div(24).toDecimalPlaces(2);
    const part = Prisma.Decimal.min(perHour.mul(remHours), c.rate);
    const days = Math.max(0, fullDays);
    return { units: Math.max(1, days), total: (days ? periodTotal(c, days) : ZERO).add(part) };
  }
  const days = Math.max(1, fullDays + (remHours > 0 ? 1 : 0));
  return { units: days, total: periodTotal(c, days) };
}

/** "Under Age Fee 21-24" → [21, 24]. Charges without a range apply to any under-25 driver. */
function ageRange(name: string): [number, number] {
  const m = name.match(/(\d{2})\s*-\s*(\d{2})/);
  return m ? [Number(m[1]), Number(m[2])] : [0, 24];
}

/** Charges applicable at a location, for a vehicle type, on a date (active, inside the effective window). */
function applicableWhere(locationId: string, vehicleTypeId: string, at: Date, tz: string = BUSINESS_TZ) {
  const day = localDateAsUtc(at, tz);
  return {
    isActive: true,
    OR: [{ locationId }, { locationId: null }],
    AND: [
      { OR: [{ allVehicleTypes: true }, { vehicleTypes: { some: { vehicleTypeId } } }] },
      { OR: [{ effectiveDate: null }, { effectiveDate: { lte: day } }] },
      { OR: [{ endDate: null }, { endDate: { gte: day } }] },
    ],
  };
}

/** Protections + extras the renter can choose online for a booking (public "Rental Options" step). */
export async function onlineOptions(tx: Tx, input: { locationId: string; vehicleTypeId: string; at: Date }) {
  const where = applicableWhere(input.locationId, input.vehicleTypeId, input.at, await locationTz(tx, input.locationId));
  const [insurances, misc] = await Promise.all([
    tx.insurance.findMany({
      where: { ...where, displayOnline: true },
      orderBy: [{ dailyRate: "asc" }, { name: "asc" }],
    }),
    tx.miscCharge.findMany({
      // only "Display Online" charges are listed; hidden defaults are still added by priceBooking
      where: { ...where, displayOnline: true, AND: [...where.AND, { OR: [{ locationId: input.locationId }, { locationId: null }] }] },
      orderBy: { name: "asc" },
    }),
  ]);
  return { insurances, misc: misc.filter((m) => !m.autoWhenUnderAge && !m.autoWhenAdditionalDriver && !m.isNoShowCharge) };
}

/**
 * Charge lines for a quote / reservation / rental, in the legacy charge-table order.
 *
 * Implements the "Standard" rate type: full days at the daily rate plus leftover hours at the
 * hourly rate (capped at one more day), with the rate's grace minutes and 24-hour vs calendar-day
 * calculation. VERIFY: Multiday, Flat, Weekend, Min/Max and the other ~70 legacy rate types are not
 * implemented yet — those rates fall back to this logic and are flagged with `approximate`.
 */
export async function priceBooking(tx: Tx, input: PricingInput) {
  const lines: ChargeDraft[] = [];
  const warnings: string[] = [];
  let approximate = false;

  const tz = await locationTz(tx, input.locationId);
  const rate = input.rateId
    ? await tx.rate.findUnique({ where: { id: input.rateId }, include: { values: { where: { vehicleTypeId: input.vehicleTypeId } } } })
    : null;
  // seasonal rates: the value row for the season containing the pickup date; else the date-range row
  const seasonIds = rate ? await seasonsAt(tx, input.pickupAt, tz) : [];
  const rv = rate?.values.find((v) => v.seasonId && seasonIds.includes(v.seasonId)) ?? rate?.values.find((v) => !v.seasonId);
  if (input.rateId && !rv) warnings.push("The selected rate has no price for this vehicle type.");
  // "Min/Max+Regular" = standard daily/hourly pricing limited to a rental-length window (applied when the rate is picked)
  if (rate && !["Standard", "Min/Max+Regular"].includes(rate.rateType)) {
    approximate = true;
    warnings.push(`Rate type "${rate.rateType}" is priced with standard daily/hourly logic for now.`);
  }

  // ── time
  const minutes = Math.max(0, Math.round((+input.returnAt - +input.pickupAt) / 60_000));
  let days: number;
  let hours = 0;
  if (rate?.calculationBy === "CALENDAR_DAY") {
    const a = localDateAsUtc(input.pickupAt, tz);
    const b = localDateAsUtc(input.returnAt, tz);
    days = Math.max(1, Math.round((+b - +a) / 86_400_000) + 1);
  } else {
    days = Math.floor(minutes / 1440);
    const rem = minutes % 1440;
    const grace = rate?.graceMinutes ?? 0;
    if (rem > grace) {
      hours = Math.ceil(rem / 60);
      const hourly = rv?.hourly ? Number(rv.hourly) : null;
      const daily = rv?.daily ? Number(rv.daily) : null;
      if (rate?.skipHourly || hourly === null || (daily !== null && hourly * hours >= daily)) {
        days += 1;
        hours = 0;
      }
    }
    if (days === 0 && hours === 0) days = 1;
    const minDays = rate?.minChargeDays ?? 0;
    if (days < minDays) {
      days = minDays;
      hours = 0;
    }
  }

  let sort = 0;
  if (rv?.hourly && hours > 0)
    lines.push({ kind: "TIME", name: "Hourly", units: D(hours), rate: rv.hourly, total: rv.hourly.mul(hours), sortOrder: sort++ });
  if (rv?.daily && days > 0) {
    // RentCentric keeps the daily rate unrounded and rounds only the total. Values copied from the rate form are
    // stored that way (4 dp). Values read off the Rates Calendar are rounded to cents; for those the true daily is
    // monthly / 30 (e.g. M 1,547.30 → 51.5767/day, shown as 51.58; 3 days = 154.73 on mrrentacar.com, not 154.74).
    const rounded = rv.daily.equals(rv.daily.toDecimalPlaces(2));
    const precise = rounded && rv.monthly && rv.monthly.div(30).sub(rv.daily).abs().lt(0.01) ? rv.monthly.div(30) : rv.daily;
    lines.push({ kind: "TIME", name: "Daily", units: D(days), rate: rv.daily, total: precise.mul(days), sortOrder: sort++ });
  }
  if (rv?.kmAllowed)
    lines.push({ kind: "MILEAGE", name: "Km Allowed", units: D(rv.kmAllowed * Math.max(1, days)), rate: ZERO, total: ZERO, sortOrder: sort++ });

  const timeTotal = lines.reduce((a, l) => a.add(l.total), ZERO);

  // ── discount
  if (input.discountType && input.discountValue) {
    const amount = input.discountType === "PERCENT" ? timeTotal.mul(input.discountValue).div(100) : D(input.discountValue);
    lines.push({
      kind: "DISCOUNT",
      name: input.discountType === "PERCENT" ? `Discount ${input.discountValue}%` : "Discount",
      units: D(1),
      rate: amount.neg(),
      total: amount.neg().toDecimalPlaces(2),
      sortOrder: sort++,
    });
  }

  const rentalDays = Math.max(1, days + (hours > 0 ? 1 : 0));
  const where = applicableWhere(input.locationId, input.vehicleTypeId, input.pickupAt, tz);
  // options use the raw length: whole days + leftover hours (after grace)
  const optGrace = rate?.graceMinutes ?? 0;
  const optDays = Math.floor(minutes / 1440);
  const optRem = minutes % 1440 > optGrace ? Math.ceil((minutes % 1440) / 60) : 0;

  // ── protection (Insurance): staff grid list, else the chosen one, else the location's default
  const insurances = input.insuranceIds
    ? await tx.insurance.findMany({ where: { id: { in: input.insuranceIds } }, orderBy: { name: "asc" } })
    : [
        input.insuranceId
          ? await tx.insurance.findUnique({ where: { id: input.insuranceId } })
          : await tx.insurance.findFirst({ where: { ...where, isDefault: true } }),
      ].filter((x): x is NonNullable<typeof x> => !!x);
  for (const insurance of insurances) {
    if (insurance.calculationBy === "FLAT") {
      lines.push({ kind: "PROTECTION", name: insurance.name, units: D(1), rate: insurance.dailyRate, total: insurance.dailyRate, insuranceId: insurance.id, sortOrder: 10 + sort++ });
      continue;
    }
    const p = chargeForPeriod({ ...insurance, rate: insurance.dailyRate }, optDays, optRem);
    lines.push({ kind: "PROTECTION", name: insurance.name, units: D(p.units), rate: insurance.dailyRate, total: p.total, insuranceId: insurance.id, sortOrder: 10 + sort++ });
  }

  // ── other charges: defaults + automatic (under age, additional driver) + chosen
  const chosen = new Map((input.miscCharges ?? []).filter((m) => m.quantity > 0).map((m) => [m.miscChargeId, m.quantity]));
  const auto = await tx.miscCharge.findMany({
    where: {
      ...where,
      OR: [
        ...(input.includeDefaults === false ? [] : [{ isDefault: true }]),
        ...(input.driverAge != null && input.driverAge < 25 ? [{ autoWhenUnderAge: true }] : []),
        ...((input.additionalDrivers ?? 0) > 0 ? [{ autoWhenAdditionalDriver: true }] : []),
      ],
      AND: [...where.AND, { OR: [{ locationId: input.locationId }, { locationId: null }] }],
    },
  });
  for (const m of auto) {
    if (m.autoWhenUnderAge) {
      const [lo, hi] = ageRange(m.name);
      if (input.driverAge == null || input.driverAge < lo || input.driverAge > hi) continue;
    }
    const qty = m.autoWhenAdditionalDriver ? input.additionalDrivers ?? 1 : 1;
    if (!chosen.has(m.id)) chosen.set(m.id, qty);
  }
  const misc = chosen.size ? await tx.miscCharge.findMany({ where: { id: { in: [...chosen.keys()] } } }) : [];
  // one charge per group (e.g. only one "under age" fee)
  const seenGroups = new Set<string>();
  const percent: typeof misc = [];
  for (const m of misc.sort((a, b) => a.name.localeCompare(b.name))) {
    // Min/Max Days (0 = no limit): e.g. monthly-subscription fees apply only to 32+ day rentals
    if ((m.minDays > 0 && rentalDays < m.minDays) || (m.maxDays > 0 && rentalDays > m.maxDays)) continue;
    if (m.group) {
      if (seenGroups.has(m.group)) continue;
      seenGroups.add(m.group);
    }
    if (m.calculationBy === "PERCENT") {
      percent.push(m);
      continue;
    }
    const qty = chosen.get(m.id) ?? 1;
    if (m.calculationBy === "FLAT") {
      lines.push({ kind: "MISC", name: m.name, units: D(qty), rate: m.rate, total: m.rate.mul(qty), miscChargeId: m.id, sortOrder: 20 + sort++ });
      continue;
    }
    const p = chargeForPeriod(m, optDays, optRem);
    lines.push({ kind: "MISC", name: m.name, units: D(p.units * qty), rate: m.rate, total: p.total.mul(qty), miscChargeId: m.id, sortOrder: 20 + sort++ });
  }
  // ── Other Charges 1-4 (free amounts)
  for (const o of input.otherCharges ?? []) {
    if (!o.amount) continue;
    const name = [o.detail, o.description].filter(Boolean).join(" — ") || "Other Charges";
    lines.push({ kind: "OTHER", name, units: D(1), rate: D(o.amount), total: D(o.amount), sortOrder: 30 + sort++ });
  }
  // percentage charges apply to everything above them (rental + protection + other charges), before tax.
  // Verified on mrrentacar.com: YYC Standard 3 days + SLC → Premium Location 9.75% of 220.49 = 21.50, total 254.09.
  const beforePercent = lines.reduce((a, l) => a.add(l.total), ZERO);
  for (const m of percent)
    lines.push({ kind: "MISC", name: m.name, units: D(1), rate: m.rate, total: beforePercent.mul(m.rate).div(100), miscChargeId: m.id, sortOrder: 40 + sort++ });

  // ── taxes for the pickup location: fixed-amount (per day) first, then % on the subtotal
  const taxes = await tx.locationTax.findMany({
    where: { locationId: input.locationId, tax: { isActive: true }, taxId: { notIn: input.excludedTaxIds ?? [] } },
    include: { tax: true },
  });
  for (const { tax } of taxes.filter((t) => t.tax.kind === "AMOUNT")) {
    const units = tax.perDay ? rentalDays : 1;
    lines.push({ kind: "TAX", name: tax.name, units: D(units), rate: tax.value, total: tax.value.mul(units), taxId: tax.id, sortOrder: 50 + sort++ });
  }
  const subTotal = lines.reduce((a, l) => a.add(l.total), ZERO);
  for (const { tax } of taxes.filter((t) => t.tax.kind === "PERCENT")) {
    lines.push({
      kind: "TAX",
      name: tax.name,
      units: D(1),
      rate: tax.value,
      total: subTotal.mul(tax.value).div(100).toDecimalPlaces(2),
      taxId: tax.id,
      sortOrder: 60 + sort++,
    });
  }

  for (const l of lines) l.total = l.total.toDecimalPlaces(2);
  const total = lines.reduce((a, l) => a.add(l.total), ZERO);
  // per-class extra-km charge from the rate value, else the rate's
  const extraKmCharge = rv?.extraKmCharge ?? rate?.extraKmCharge ?? null;
  return { lines, total, subTotal, days, hours, approximate, warnings, extraKmCharge };
}
