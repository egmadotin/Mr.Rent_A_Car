import { notFound, redirect } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { optionsFromChargeLines } from "../../../../../_components/booking-values";
import { ReservationForm } from "../../_components/reservation-form";
import type { RateOverride } from "../../../../../_components/rate-details";

export const metadata = { title: "Edit reservation" };

const d = (x: Date | null | undefined) => (x ? new Date(x).toISOString().slice(0, 10) : "");
/** ISO instant; the form shows it in the pickup location's time zone (`timeZone`). */
const dt = (x: Date) => new Date(x).toISOString();

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await (await api()).reservation.byId({ reservationId: id }).catch(() => null);
  if (!data) notFound();
  const r = data.reservation;
  if (r.status !== "TENTATIVE" && r.status !== "CONFIRMED") redirect(`/admin/reservations/${id}`);
  const c = r.customer;

  // the options grid selection, rebuilt from the stored charge lines
  const days = Math.max(1, Math.floor((+r.returnAt - +r.pickupAt) / 86_400_000));
  const options = { ...optionsFromChargeLines(r.chargeLines, r.excludedTaxIds, days), rateOverride: r.rateOverride as RateOverride | null };

  const s = (x: string | null | undefined) => x ?? "";
  return (
    <>
      <PageHeader
        title={`Edit reservation #${r.number}`}
        breadcrumbs={[{ label: "Reservations", href: "/admin/reservations" }, { label: `#${r.number}`, href: `/admin/reservations/${r.id}` }, { label: "Edit" }]}
      />
      <ReservationForm
        initial={{
          reservationId: r.id,
          number: r.number,
          createdAt: r.createdAt.toISOString(),
          options,
          drivers: r.drivers.map(({ customer: x }) => ({ id: x.id, firstName: x.firstName, lastName: x.lastName, licenseNumber: x.licenseNumber, licenseExpiry: x.licenseExpiry })),
          values: {
            status: r.status,
            customerId: s(r.customerId),
            saveCustomer: false,
            firstName: r.firstName,
            middleName: s(r.middleName),
            lastName: r.lastName,
            email: s(r.email),
            phone: s(r.phone),
            localPhone: s(c?.localPhone),
            licenseNumber: s(c?.licenseNumber),
            licenseExpiry: d(c?.licenseExpiry),
            licenseProvince: s(c?.licenseProvince),
            birthDate: d(c?.birthDate),
            address1: s(c?.address1),
            address2: s(c?.address2),
            city: s(c?.city),
            province: s(c?.province),
            postal: s(c?.postal),
            country: s(c?.country),
            insuranceCompany: s(c?.insuranceCompany),
            insurancePolicyNumber: s(c?.insurancePolicyNumber),
            insuranceExpiry: d(c?.insuranceExpiry),
            insurancePhone: s(c?.insurancePhone),
            insuranceFax: s(c?.insuranceFax),
            locationId: r.locationId,
            pickupLocationId: r.pickupLocationId,
            returnLocationId: r.returnLocationId,
            timeZone: r.pickupLocation.timeZone,
            pickupAt: dt(r.pickupAt),
            returnAt: dt(r.returnAt),
            vehicleTypeId: r.vehicleTypeId,
            vehicleId: s(r.vehicleId),
            rateId: s(r.rateId),
            companyId: s(r.companyId),
            discountType: s(r.discountType),
            discountValue: r.discountValue ? String(r.discountValue) : "",
            discountReasonId: s(r.discountReasonId),
            deposit: r.deposit ? String(r.deposit) : "",
            referralId: s(r.referralId),
            deliveryAddress: s(r.deliveryAddress),
            airline: s(r.airline),
            flightNumber: s(r.flightNumber),
            hotel: s(r.hotel),
            arrivalAirport: s(r.arrivalAirport),
            preferredLanguage: s(r.preferredLanguage),
            poNumber: s(r.poNumber),
            roNumber: s(r.roNumber),
            customerNotes: s(r.customerNotes),
            isLoaner: r.isLoaner,
            isNonRevenue: r.isNonRevenue,
          },
        }}
      />
    </>
  );
}
