import { PageHeader } from "../../../../_components/page-header";
import { customerValues } from "../../../../_components/booking-customer";
import { api, requireStaff, workingLocationId } from "../../../../_lib/session";
import { StartRentalForm, type StartRentalInitial } from "./start-rental-form";

export const metadata = { title: "Start a Rental" };

/**
 * Walk-in "Start a Rental" (legacy CheckOut3.aspx?DoAction=New).
 * ?customerId=… "Start rental" from a customer (renter prefilled).
 * ?vehicleId=…  "Rent" from the vehicle list (type, vehicle and location prefilled).
 */
export default async function NewRentalPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string; customerId?: string }> }) {
  const sp = await searchParams;
  const session = await requireStaff();
  const locationId = await workingLocationId();
  const staff = await api();

  let initial: StartRentalInitial | undefined;
  if (sp.customerId) {
    const data = await staff.customer.byId({ customerId: sp.customerId }).catch(() => null);
    if (data) initial = { values: { customerId: data.customer.id, ...customerValues(data.customer), companyId: data.customer.companyId ?? "" } };
  }
  if (sp.vehicleId) {
    const v = await staff.vehicle.byId({ vehicleId: sp.vehicleId }).catch(() => null);
    if (v)
      initial = {
        values: {
          ...initial?.values,
          vehicleTypeId: v.vehicleTypeId,
          vehicleId: v.id,
          odometerOut: String(v.currentOdometer ?? ""),
          fuelOut: String(v.fuelLevel ?? 16),
          pickupLocationId: v.rentalLocationId,
          returnLocationId: v.rentalLocationId,
        },
      };
  }

  return (
    <>
      <PageHeader title="Start a Rental" breadcrumbs={[{ label: "Rent", href: "/admin/rentals" }, { label: "Start a Rental" }]} />
      <StartRentalForm initial={initial} defaultLocationId={locationId} currentUserId={session.user.id} />
    </>
  );
}
