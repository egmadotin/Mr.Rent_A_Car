import { z } from "zod";
import { Prisma } from "@mrac/db";

/**
 * "Rate (i)" next to Rate on Quote / Reserve / Start Rental (RentCentric RateDetails.aspx): the booking's own rate values.
 * Each value left blank keeps the rate's own value. Stored on the booking (`rateOverride`) so a re-price keeps it.
 */
const amount = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0, "Can't be negative").finite().nullable()).optional();
const km = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int("Whole km").min(0, "Can't be negative").nullable()).optional();

export const rateOverrideInput = z.object({
  hourly: amount,
  daily: amount,
  extraDaily: amount,
  weekly: amount,
  monthly: amount,
  fuelCharge: amount,
  kmHourly: km,
  kmDaily: km,
  kmWeekly: km,
  kmMonthly: km,
  kmCharge: amount,
  propaneUnitCharge: amount,
  /** "Override Date Specific Rate" */
  overrideDateSpecific: z.boolean().optional(),
});
export type RateOverride = z.infer<typeof rateOverrideInput>;

const VALUE_KEYS = ["hourly", "daily", "extraDaily", "weekly", "monthly", "fuelCharge", "kmHourly", "kmDaily", "kmWeekly", "kmMonthly", "kmCharge", "propaneUnitCharge"] as const;

/** The override as stored: null when nothing is set, so an untouched Rate (i) leaves the booking as before. */
export function storedRateOverride(o: RateOverride | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!o) return Prisma.DbNull;
  const kept = Object.fromEntries(Object.entries(o).filter(([k, v]) => (k === "overrideDateSpecific" ? v === true : v != null)));
  return VALUE_KEYS.some((k) => kept[k] != null) || kept.overrideDateSpecific ? kept : Prisma.DbNull;
}

/** A booking's stored override back as input (for the edit forms and re-pricing). */
export function readRateOverride(v: Prisma.JsonValue | null | undefined): RateOverride | null {
  const r = rateOverrideInput.safeParse(v ?? null);
  return r.success ? r.data : null;
}

type Values = {
  hourly: Prisma.Decimal | null;
  daily: Prisma.Decimal | null;
  extraDaily: Prisma.Decimal | null;
  weekly: Prisma.Decimal | null;
  monthly: Prisma.Decimal | null;
  kmAllowed: number | null;
  kmHourly: number | null;
  kmWeekly: number | null;
  kmMonthly: number | null;
  extraKmCharge: Prisma.Decimal | null;
};

/** The rate's value row for this vehicle type with the booking's override applied (blank override = keep the rate's). */
export function applyRateOverride<T extends Partial<Values>>(rv: T | undefined, o: RateOverride | null | undefined): (T & Values) | undefined {
  if (!o) return rv as (T & Values) | undefined;
  const dec = (n: number | null | undefined, base: Prisma.Decimal | null | undefined) => (n == null ? (base ?? null) : new Prisma.Decimal(n));
  const int = (n: number | null | undefined, base: number | null | undefined) => (n == null ? (base ?? null) : n);
  return {
    ...(rv ?? ({} as T)),
    hourly: dec(o.hourly, rv?.hourly),
    daily: dec(o.daily, rv?.daily),
    extraDaily: dec(o.extraDaily, rv?.extraDaily),
    weekly: dec(o.weekly, rv?.weekly),
    monthly: dec(o.monthly, rv?.monthly),
    kmAllowed: int(o.kmDaily, rv?.kmAllowed),
    kmHourly: int(o.kmHourly, rv?.kmHourly),
    kmWeekly: int(o.kmWeekly, rv?.kmWeekly),
    kmMonthly: int(o.kmMonthly, rv?.kmMonthly),
    extraKmCharge: dec(o.kmCharge, rv?.extraKmCharge),
  };
}
