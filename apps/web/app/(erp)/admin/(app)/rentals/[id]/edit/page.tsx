import { notFound, redirect } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api, requireStaff } from "../../../../../_lib/session";
import { StartRentalForm } from "../../new/start-rental-form";
import { rentalFormInitial } from "../../_lib/rental-form-values";

export const metadata = { title: "Edit Rental" };

/** Edit Rental (Checkout3.aspx?CustomerID=…&AgreementID=…): the Start a Rental form, filled from the agreement. */
export default async function EditRentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const data = await (await api()).rental.byId({ rentalId: id }).catch(() => null);
  if (!data) notFound();
  const r = data.rental;
  if (r.status === "VOIDED") redirect(`/admin/rentals/${id}`);

  return (
    <>
      <PageHeader
        title="Edit Rental"
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
          closed: r.status === "CLOSED",
          vehicle: { id: r.vehicleId, label: `${r.vehicle.assignedId} — ${r.vehicle.year ?? ""} ${r.vehicle.make.name} ${r.vehicle.model.name}` },
        }}
        initial={rentalFormInitial(r)}
      />
    </>
  );
}
