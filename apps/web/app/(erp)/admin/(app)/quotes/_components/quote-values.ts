import type { RouterOutputs } from "@mrac/api";
import type { BookingOptions } from "../../../../_components/options-grid";

type Quote = RouterOutputs["staff"]["quote"]["byId"]["quote"];

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

/** Quote → form values. Shared by "Edit quote" and "Make reservation from quote". Dates are ISO; forms localise them. */
export function quoteToValues(q: Quote) {
  const days = Math.max(1, Math.floor((+q.returnAt - +q.pickupAt) / 86_400_000));
  const options = optionsFromChargeLines(q.chargeLines, q.excludedTaxIds, days);
  const values: Record<string, string> = {
    pickupAt: new Date(q.pickupAt).toISOString(),
    returnAt: new Date(q.returnAt).toISOString(),
    pickupLocationId: q.pickupLocationId,
    returnLocationId: q.returnLocationId,
    vehicleTypeId: q.vehicleTypeId,
    rateId: q.rateId ?? "",
    companyId: q.companyId ?? "",
    discountType: q.discountType ?? "",
    discountValue: q.discountValue ? String(q.discountValue) : "",
    referralId: q.referralId ?? "",
    customerId: q.customerId ?? "",
    firstName: q.firstName ?? "",
    lastName: q.lastName ?? "",
    email: q.email ?? "",
    contactPhone: q.contactPhone ?? "",
    timeZone: q.pickupLocation.timeZone,
  };
  // legacy `misc` map kept for the reservation form until it moves to the shared grid
  const misc = Object.fromEntries(options.miscCharges.map((m) => [m.miscChargeId, m.quantity]));
  return { values, options, misc };
}
