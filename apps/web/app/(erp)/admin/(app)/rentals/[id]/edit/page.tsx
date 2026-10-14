import { notFound, redirect } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { customerValues, optionsFromChargeLines } from "../../../../../_components/booking-values";
import { api, requireStaff } from "../../../../../_lib/session";
import { StartRentalForm } from "../../new/start-rental-form";

export const metadata = { title: "Edit Rental" };

const s = (x: string | null | undefined) => x ?? "";
const n = (x: unknown) => (x == null ? "" : String(x));

/** Edit Rental (Checkout3.aspx?CustomerID=…&AgreementID=…): the Start a Rental form, filled from the agreement. */
export default async function EditRentalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ end?: string }> }) {
  const { id } = await params;
  // "End Rental": the same form with the check-in fields, saved with close
  const ending = (await searchParams).end === "1";
  const session = await requireStaff();
  const data = await (await api()).rental.byId({ rentalId: id }).catch(() => null);
  if (!data) notFound();
  const r = data.rental;
  if (r.status === "VOIDED" || (ending && r.status !== "OPEN")) redirect(`/admin/rentals/${id}`);

  const end = r.checkedInAt ?? r.expectedReturnAt;
  const days = Math.max(1, Math.ceil((+end - +r.checkOutAt) / 86_400_000));
  // re-priced lines only: adjustments, tickets etc. are kept by the API and aren't options
  const priced = r.chargeLines.filter((l) => !l.name.startsWith("Adjustment — "));
  const options = optionsFromChargeLines(priced, r.excludedTaxIds, days);
  const fuel = priced.find((l) => l.kind === "FUEL");
  const upgrade = priced.find((l) => l.kind === "UPGRADE");
  const latestMemo = r.memos.find((m) => m.kind === "MEMO");

  return (
    <>
      <PageHeader
        title={ending ? "End Rental" : "Edit Rental"}
        breadcrumbs={[
          { label: `${`${r.customer.firstName} ${r.customer.lastName}`.toUpperCase()}`, href: `/admin/customers/${r.customerId}` },
          { label: "Rentals", href: "/admin/rentals" },
          { label: `Rental# ${r.raNumber}`, href: `/admin/rentals/${r.id}` },
        ]}
      />
      <StartRentalForm
        currentUserId={session.user.id}
        editing={{
          rentalId: r.id,
          raNumber: r.raNumber,
          closed: r.status === "CLOSED" || ending,
          ending,
          vehicle: { id: r.vehicleId, label: `${r.vehicle.assignedId} — ${r.vehicle.year ?? ""} ${r.vehicle.make.name} ${r.vehicle.model.name}` },
        }}
        initial={{
          options,
          values: {
            customerId: r.customerId,
            ...customerValues(r.customer),
            timeZone: r.checkOutLocation.timeZone,
            pickupAt: r.checkOutAt.toISOString(),
            returnAt: r.expectedReturnAt.toISOString(),
            checkedInAt: r.checkedInAt ? r.checkedInAt.toISOString() : ending ? new Date().toISOString() : "",
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
        }}
      />
    </>
  );
}
