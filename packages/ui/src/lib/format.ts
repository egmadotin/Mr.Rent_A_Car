import { BUSINESS_TZ, fromZonedInput, toZonedInput } from "./tz";

export { BUSINESS_TZ } from "./tz";

type Num = number | string | { toString(): string } | null | undefined;

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

/** $1,234.50; negatives in accounting style: ($98.63) — matches the legacy charge tables. */
export function money(v: Num, { accounting = true }: { accounting?: boolean } = {}) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v.toString());
  if (!Number.isFinite(n)) return "—";
  if (accounting && n < 0) return `(${cad.format(-n)})`;
  return cad.format(n);
}

/** Date-time in business (location) time — never the viewer's own zone. */
export function dateTime(v: Date | string | null | undefined, tz: string = BUSINESS_TZ) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/**
 * Calendar date. Formatted in UTC because date-only columns (licence expiry, DOB, inspection
 * date …) are stored as UTC midnight — formatting them in a local zone west of UTC would show
 * the previous day.
 */
export function date(v: Date | string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Fuel in sixteenths, shown like the legacy "8/16". */
export function fuel(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${v}/16`;
}

export function fullName(p: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null | undefined) {
  if (!p) return "—";
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

/** Value for <input type="datetime-local">, in business (location) time. */
export function toDateTimeLocal(d: Date | string | null | undefined, tz: string = BUSINESS_TZ) {
  return toZonedInput(d, tz);
}

/** Parse an <input type="datetime-local"> value entered in business (location) time. */
export function fromDateTimeLocal(s: string | null | undefined, tz: string = BUSINESS_TZ) {
  return fromZonedInput(s, tz);
}
