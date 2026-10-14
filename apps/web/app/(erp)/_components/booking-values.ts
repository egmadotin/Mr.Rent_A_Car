// Server-safe helpers for the booking forms (no "use client"), shared by quotes, reservations and rentals.
import type { BookingOptions } from "./options-grid";

/** Rebuild the options-grid selection from stored charge lines (quote, reservation or rental). */
export function optionsFromChargeLines(
  lines: { kind: string; miscChargeId: string | null; insuranceId: string | null; units: unknown; rate: unknown; name: string; miscCharge?: { calculationBy: string } | null }[],
  excludedTaxIds: string[],
  days: number,
): BookingOptions {
  return {
    insuranceIds: lines.filter((l) => l.kind === "PROTECTION" && l.insuranceId).map((l) => l.insuranceId!),
    miscCharges: lines
      .filter((l) => l.kind === "MISC" && l.miscChargeId)
      .map((l) => ({
        miscChargeId: l.miscChargeId!,
        quantity: Math.max(1, Math.round(Number(l.units) / (l.miscCharge?.calculationBy === "FLAT" || l.miscCharge?.calculationBy === "PERCENT" ? 1 : days))),
      })),
    excludedTaxIds,
    otherCharges: lines
      .filter((l) => l.kind === "OTHER")
      .map((l) => {
        const parts = l.name.split(" — ");
        return parts.length > 1 ? { amount: Number(l.rate), detail: parts[0], description: parts[1] } : { amount: Number(l.rate), detail: null, description: l.name === "Other Charges" ? null : l.name };
      }),
  };
}

/** The renter profile fields shared by the Reserve and Start a Rental "Customer" tabs (and `customerInput` on the API). */
export const CUSTOMER_FIELDS = [
  "firstName", "middleName", "lastName", "email", "phone", "localPhone", "companyPhone", "licenseNumber", "licenseExpiry",
  "licenseProvince", "birthDate", "address1", "address2", "city", "province", "postal", "country", "insuranceCompany",
  "insurancePolicyNumber", "insuranceExpiry", "insurancePhone", "insuranceFax",
] as const;
export type CustomerField = (typeof CUSTOMER_FIELDS)[number];
const DATE_FIELDS = new Set<string>(["licenseExpiry", "birthDate", "insuranceExpiry"]);

/** Form values from a customer record (dates as yyyy-mm-dd, nulls as ""). */
export function customerValues(c: Record<string, unknown>) {
  return Object.fromEntries(
    CUSTOMER_FIELDS.map((f) => {
      const val = c[f];
      return [f, val == null ? "" : DATE_FIELDS.has(f) ? new Date(val as string).toISOString().slice(0, 10) : String(val)];
    }),
  ) as Record<CustomerField, string>;
}
