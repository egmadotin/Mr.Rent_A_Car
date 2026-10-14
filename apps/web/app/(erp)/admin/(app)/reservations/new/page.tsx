import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { api, requireStaff } from "../../../../_lib/session";
import { quoteToValues } from "../../quotes/_components/quote-values";
import { ReservationForm, type ReservationFormInitial } from "../_components/reservation-form";

export const metadata = { title: "New reservation" };

/**
 * ?quoteId=…        "Make New Reservation" from a quote: prefilled and linked to it.
 * ?quoteId=…&start=1 "Start Rental" from a quote: same, then Start rental opens on save.
 * ?vehicleId=…      "Reserve" from the vehicle list.
 * ?customerId=…     "New reservation" / "Start rental" from a customer (renter prefilled).
 */
export default async function NewReservationPage({ searchParams }: { searchParams: Promise<{ quoteId?: string; start?: string; vehicleId?: string; customerId?: string }> }) {
  const session = await requireStaff();
  const sp = await searchParams;
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  const staff = await api();

  let initial: ReservationFormInitial | undefined;
  let title = "New reservation";
  if (sp.quoteId) {
    const data = await staff.quote.byId({ quoteId: sp.quoteId }).catch(() => null);
    if (data) {
      const q = data.quote;
      const { values, misc } = quoteToValues(q);
      const [first, ...rest] = (q.contactName ?? "").split(" ");
      initial = {
        values: {
          ...values,
          quoteId: q.id,
          locationId: q.pickupLocationId,
          firstName: q.customer?.firstName ?? first ?? "",
          lastName: q.customer?.lastName ?? rest.join(" "),
          phone: q.customer?.phone ?? q.contactPhone ?? "",
          email: q.customer?.email ?? "",
          status: "CONFIRMED",
          saveCustomer: true,
        },
        misc,
      };
      title = `New reservation from quote #${q.number}`;
    }
  } else if (sp.customerId) {
    const data = await staff.customer.byId({ customerId: sp.customerId }).catch(() => null);
    if (data) {
      const c = data.customer;
      const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");
      const s = (x: string | null) => x ?? "";
      initial = {
        values: {
          customerId: c.id,
          saveCustomer: false,
          firstName: c.firstName, middleName: s(c.middleName), lastName: c.lastName, email: s(c.email), phone: s(c.phone), localPhone: s(c.localPhone),
          licenseNumber: s(c.licenseNumber), licenseExpiry: d(c.licenseExpiry), licenseProvince: s(c.licenseProvince), birthDate: d(c.birthDate),
          address1: s(c.address1), address2: s(c.address2), city: s(c.city), province: s(c.province), postal: s(c.postal), country: s(c.country),
          insuranceCompany: s(c.insuranceCompany), insurancePolicyNumber: s(c.insurancePolicyNumber), insuranceExpiry: d(c.insuranceExpiry),
          insurancePhone: s(c.insurancePhone), insuranceFax: s(c.insuranceFax), companyId: s(c.companyId),
          ...(sp.start === "1" ? { status: "CONFIRMED" } : {}),
        },
        misc: {},
      };
      title = sp.start === "1" ? `Start rental for ${c.firstName} ${c.lastName}` : `New reservation for ${c.firstName} ${c.lastName}`;
    }
  } else if (sp.vehicleId) {
    const v = await staff.vehicle.byId({ vehicleId: sp.vehicleId }).catch(() => null);
    if (v) initial = { values: { vehicleTypeId: v.vehicleTypeId, vehicleId: v.id, pickupLocationId: v.rentalLocationId, returnLocationId: v.rentalLocationId, locationId: v.rentalLocationId, ...(sp.start === "1" ? { status: "CONFIRMED" } : {}) }, misc: {} };
    if (v && sp.start === "1") title = `Start rental — ${v.assignedId}`;
  } else if (sp.start === "1") {
    title = "Start rental";
    initial = { values: { status: "CONFIRMED" }, misc: {} };
  }

  return (
    <>
      <PageHeader title={title} breadcrumbs={[{ label: "Reservations", href: "/admin/reservations" }, { label: "New" }]} />
      <ReservationForm initial={initial} defaultLocationId={locationId} startRentalAfterSave={sp.start === "1"} />
    </>
  );
}
