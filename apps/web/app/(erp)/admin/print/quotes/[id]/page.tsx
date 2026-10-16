import { notFound } from "next/navigation";
import { LocalDateTime } from "@mrac/ui/components/local-time";
import { api } from "../../../../_lib/session";
import { PrintButton } from "../../_components/print-button";
import { TemplatePicker } from "../../_components/template-picker";
import { TemplatePrint } from "../../_components/template-print";
import { InfoRows, PrintChargeTable, PrintFooter, PrintHeader, PrintPage, PrintSection, VehicleCard } from "../../_components/print-kit";

export const metadata = { title: "Print quote" };

/** Matches RentCentric PrintQuoteRW.aspx: header, quote details, Your Vehicle, Your Time and Place, charges, footer. */
export default async function PrintQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  // ?t=<template name>: printed with a quote template from Settings > Rentals & Invoices; otherwise the standard layout
  const { t: templateName } = await searchParams;
  const staff = await api();
  const templates = await staff.template.list({ kind: "QUOTE", activeOnly: true });
  if (templateName) {
    const doc = await staff.template.render({ kind: "QUOTE", id, name: templateName });
    if (doc.html) return <TemplatePrint html={doc.html} current={templateName} names={[...new Set(templates.map((x) => x.name))]} builtIn="Print Quote (standard)" />;
  }
  const data = await staff.quote.byId({ quoteId: id }).catch(() => null);
  if (!data) notFound();
  const q = data.quote;
  const vt = q.vehicleType;
  const minutes = (+q.returnAt - +q.pickupAt) / 60_000;
  const days = Math.max(1, Math.ceil(minutes / 1440));
  const timeDays = q.chargeLines.find((l) => l.kind === "TIME" && l.name === "Daily");
  const km = q.chargeLines.find((l) => l.kind === "MILEAGE");
  const rv = q.rate?.values.find((v) => v.vehicleTypeId === q.vehicleTypeId);

  return (
    <PrintPage>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">{templates.length > 0 ? <TemplatePicker current="" names={[...new Set(templates.map((x) => x.name))]} builtIn="Print Quote (standard)" /> : <span />}<PrintButton /></div>
      <PrintHeader
        location={q.pickupLocation}
        title="Quote"
        number={q.number}
        date={<LocalDateTime value={q.createdAt} timeZone={q.pickupLocation.timeZone} />}
      />

      <div className="grid grid-cols-2 gap-4">
        <PrintSection title="Customer">
          <InfoRows
            rows={[
              ["First Name", q.firstName ?? q.customer?.firstName],
              ["Last Name", q.lastName ?? q.customer?.lastName],
              ["Email", q.email ?? q.customer?.email],
              ["Phone", q.contactPhone ?? q.customer?.phone],
              ["Company", q.company?.name],
            ]}
          />
        </PrintSection>
        <PrintSection title="Quote">
          <InfoRows
            rows={[
              ["Quote Number", q.number],
              ["Date", <LocalDateTime key="d" value={q.createdAt} timeZone={q.pickupLocation.timeZone} />],
              ["Quote By", q.createdBy?.name],
            ]}
          />
        </PrintSection>
      </div>

      <PrintSection title="Your Vehicle">
        <VehicleCard type={vt} />
      </PrintSection>

      <PrintSection title="Your Time and Place">
        <InfoRows
          rows={[
            ["Pickup Location", q.pickupLocation.name],
            ["Return Location", q.returnLocation.name],
            ["Pickup Date", <LocalDateTime key="p" value={q.pickupAt} timeZone={q.pickupLocation.timeZone} />],
            ["Return Date", <LocalDateTime key="r" value={q.returnAt} timeZone={q.pickupLocation.timeZone} />],
            ["Rental Days", `${timeDays ? Number(timeDays.units) : days} Day(s)`],
            ["Total Mileage Included", km ? Number(km.units) : null],
            ["Mileage Included", rv ? `Daily: ${rv.kmAllowed ?? 0}, Weekly: ${rv.kmWeekly ?? 0}, Monthly: ${rv.kmMonthly ?? 0}` : null],
            ["Fuel Charge", q.rate ? Number(q.rate.fuelChargePerUnit).toFixed(2) : null],
            ["Grace Minutes", q.rate?.graceMinutes ?? null],
          ]}
        />
      </PrintSection>

      <PrintChargeTable lines={q.chargeLines} />
      <PrintFooter />
    </PrintPage>
  );
}
