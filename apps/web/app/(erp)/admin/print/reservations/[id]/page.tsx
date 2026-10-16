import { notFound } from "next/navigation";
import { LocalDateTime } from "@mrac/ui/components/local-time";
import { api } from "../../../../_lib/session";
import { PrintButton } from "../../_components/print-button";
import { TemplatePicker } from "../../_components/template-picker";
import { TemplatePrint } from "../../_components/template-print";
import { InfoRows, PrintChargeTable, PrintFooter, PrintHeader, PrintPage, PrintSection, VehicleCard } from "../../_components/print-kit";

export const metadata = { title: "Print reservation" };

/**
 * Matches RentCentric "Print Reservation Detail" (ReservationEmailPrint.aspx): header, Reservation
 * (Res Number, Date, Opened By, customer), Your Vehicle, Your Time and Place, charges, payments, balance, footer.
 */
export default async function PrintReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  // ?t=<template name>: printed with a reservation template from Settings > Rentals & Invoices; otherwise the standard layout
  const { t: templateName } = await searchParams;
  const staff = await api();
  const templates = await staff.template.list({ kind: "RESERVATION", activeOnly: true });
  if (templateName) {
    const doc = await staff.template.render({ kind: "RESERVATION", id, name: templateName });
    if (doc.html) return <TemplatePrint html={doc.html} current={templateName} names={[...new Set(templates.map((x) => x.name))]} builtIn="Reservation Detail (standard)" />;
  }
  const data = await staff.reservation.byId({ reservationId: id }).catch(() => null);
  if (!data) notFound();
  const r = data.reservation;
  const tz = r.pickupLocation.timeZone;
  const days = Math.max(1, Math.ceil((+r.returnAt - +r.pickupAt) / 86_400_000));
  const timeDays = r.chargeLines.find((l) => l.kind === "TIME" && l.name === "Daily");
  const km = r.chargeLines.find((l) => l.kind === "MILEAGE");
  const rv = r.rate?.values.find((v) => v.vehicleTypeId === r.vehicleTypeId);
  const c = r.customer;

  return (
    <PrintPage>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">{templates.length > 0 ? <TemplatePicker current="" names={[...new Set(templates.map((x) => x.name))]} builtIn="Reservation Detail (standard)" /> : <span />}<PrintButton /></div>
      <PrintHeader location={r.pickupLocation} title="Reservation" number={r.number} date={<LocalDateTime value={r.createdAt} timeZone={tz} />} />

      <div className="grid grid-cols-2 gap-4">
        <PrintSection title="Customer">
          <InfoRows
            rows={[
              // the renter is stored on the reservation; the customer record may not exist (walk-ins)
              ["First Name", r.firstName || c?.firstName],
              ["Last Name", r.lastName || c?.lastName],
              ["Email", r.email || c?.email],
              ["Phone", r.phone || c?.phone],
              ["Company", r.company?.name],
            ]}
          />
        </PrintSection>
        <PrintSection title="Reservation">
          <InfoRows
            rows={[
              ["Res Number", r.number],
              ["Date", <LocalDateTime key="d" value={r.createdAt} timeZone={tz} />],
              ["Opened By", r.createdBy?.name],
              ["Status", r.status.replace("_", " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase())],
            ]}
          />
        </PrintSection>
      </div>

      <PrintSection title="Your Vehicle">
        <VehicleCard
          type={r.vehicleType}
          extra={r.vehicle ? <div className="pt-1 text-muted-foreground">Assigned: {r.vehicle.year} {r.vehicle.make.name} {r.vehicle.model.name} ({r.vehicle.assignedId})</div> : null}
        />
      </PrintSection>

      <PrintSection title="Your Time and Place">
        <InfoRows
          rows={[
            ["Pickup Location", r.pickupLocation.name],
            ["Return Location", r.returnLocation.name],
            ["Pickup Date", <LocalDateTime key="p" value={r.pickupAt} timeZone={tz} />],
            ["Return Date", <LocalDateTime key="r" value={r.returnAt} timeZone={tz} />],
            ["Rental Days", `${timeDays ? Number(timeDays.units) : days} Day(s)`],
            ["Total Mileage Included", km ? Number(km.units) : null],
            ["Mileage Included", rv ? `Daily: ${rv.kmAllowed ?? 0}, Weekly: ${rv.kmWeekly ?? 0}, Monthly: ${rv.kmMonthly ?? 0}` : null],
            ["Fuel Charge", r.rate ? `$${Number(r.rate.fuelChargePerUnit).toFixed(2)}` : null],
            ["Grace Minutes", r.rate?.graceMinutes ?? null],
          ]}
        />
      </PrintSection>

      <PrintChargeTable lines={r.chargeLines} payments={r.payments} />
      <PrintFooter />
    </PrintPage>
  );
}
