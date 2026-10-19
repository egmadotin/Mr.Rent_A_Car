import type { RouterOutputs } from "@mrac/api";
import { optionsFromChargeLines } from "../../../../_components/booking-values";
import type { RateOverride } from "../../../../_components/rate-details";

type Quote = RouterOutputs["staff"]["quote"]["byId"]["quote"];

/** Quote → form values. Shared by "Edit quote" and "Make reservation from quote". Dates are ISO; forms localise them. */
export function quoteToValues(q: Quote) {
  const days = Math.max(1, Math.floor((+q.returnAt - +q.pickupAt) / 86_400_000));
  const options = { ...optionsFromChargeLines(q.chargeLines, q.excludedTaxIds, days), rateOverride: q.rateOverride as RateOverride | null };
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
  return { values, options };
}
