// Server-safe: the Start a Rental form's values for an existing rental (Edit Rental and End Rental pages).
import type { RouterOutputs, Wire } from "@mrac/api";
import { customerValues, optionsFromChargeLines } from "../../../../_components/booking-values";

type Rental = Awaited<RouterOutputs["staff"]["rental"]["byId"]>["rental"];
const s = (x: string | null | undefined) => x ?? "";
const n = (x: unknown) => (x == null ? "" : String(x));

/** `ending`: End Rental — Return Date defaults to now and Fuel In to Fuel Out. */
export function rentalFormInitial(r: Rental | Wire<Rental>, { ending = false }: { ending?: boolean } = {}) {
  const end = r.checkedInAt ?? r.expectedReturnAt;
  const days = Math.max(1, Math.ceil((+new Date(end) - +new Date(r.checkOutAt)) / 86_400_000));
  // re-priced lines only: adjustments, tickets etc. are kept by the API and aren't options
  const priced = r.chargeLines.filter((l) => !l.name.startsWith("Adjustment — "));
  const options = optionsFromChargeLines(priced, r.excludedTaxIds, days);
  const fuel = priced.find((l) => l.kind === "FUEL");
  const upgrade = priced.find((l) => l.kind === "UPGRADE");
  const latestMemo = r.memos.find((m) => m.kind === "MEMO");

  return {
    options,
    values: {
      customerId: r.customerId,
      ...customerValues(r.customer),
      timeZone: r.checkOutLocation.timeZone,
      pickupAt: new Date(r.checkOutAt).toISOString(),
      returnAt: new Date(r.expectedReturnAt).toISOString(),
      checkedInAt: r.checkedInAt ? new Date(r.checkedInAt).toISOString() : ending ? new Date().toISOString() : "",
      pickupLocationId: r.checkOutLocationId,
      returnLocationId: r.checkInLocationId,
      vehicleTypeId: r.vehicleTypeId,
      vehicleId: r.vehicleId,
      rateId: s(r.rateId),
      companyId: s(r.companyId),
      discountType: r.discountType ?? "PERCENT",
      discountValue: n(r.discountValue),
      discountReasonId: s(r.discountReasonId),
      deposit: n(r.deposit),
      odometerOut: n(r.odometerOut),
      odometerIn: n(r.odometerIn),
      fuelOut: n(r.fuelOut ?? 16),
      fuelIn: n(r.fuelIn ?? (ending ? r.fuelOut ?? 16 : 0)),
      prepaidFuel: r.prepaidFuel,
      fuelCharge: fuel ? n(fuel.total) : "",
      upgradeType: upgrade ? (Number(upgrade.units) > 1 ? "DAILY" : "FLAT") : "",
      upgradeAmount: upgrade ? n(upgrade.rate) : "",
      referralId: s(r.referralId),
      claimNumber: s(r.claimNumber),
      airport: s(r.airport),
      airline: s(r.airline),
      flightNumber: s(r.flightNumber),
      poNumber: s(r.poNumber),
      roNumber: s(r.roNumber),
      rentalReasonId: s(r.rentalReasonId),
      openedById: s(r.openedById),
      memo: latestMemo?.body ?? "",
      isNonRevenue: r.isNonRevenue,
    },
  };
}
