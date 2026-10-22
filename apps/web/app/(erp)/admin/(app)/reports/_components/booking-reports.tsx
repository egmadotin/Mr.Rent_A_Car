"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymdhm } from "./report-kit";

/** Rental Details, Invoices, Rental Event Tracking and Reservation Event Tracking, as RentCentric's. */

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const rental = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link>;
const STATUS = [{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }];

/** Rental Details (ReportsRentalDetailsReport.aspx). */
export function RentalDetailsReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", dateInFrom: "", dateInTo: "", locationOutId: "", locationInId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.rentalDetails.queryOptions({
      from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), dateInFrom: fromDay(run?.dateInFrom ?? ""), dateInTo: fromDay(run?.dateInTo ?? ""),
      locationOutId: run?.locationOutId, locationInId: run?.locationInId, status: (run?.status || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Rental Details" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="rdt-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="rdt-t" label="End Date" value={v.to} onChange={set("to")} />
        <DateField id="rdt-ia" label="Date In Start" value={v.dateInFrom} onChange={set("dateInFrom")} />
        <DateField id="rdt-ib" label="Date In End" value={v.dateInTo} onChange={set("dateInTo")} />
        <SelectFilter id="rdt-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="rdt-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
        <SelectFilter id="rdt-st" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="ALL" />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && t && (
        <div className="overflow-x-auto">
          <ReportTable
            head={["RA#", "Customer ID", "First Name", "Last Name", "Customer Phone", "Customer Email", "Res#", "Vehicle", "Vehicle Type", "Pickup Location", "Pickup Date", "Return Date", "Return Location", "Status", "Opened by", "Closed by", "Close Date", "Days", "Time", "Discount", "Mileage", "Fuel", "Upgrade", "One Way", "Damage", "Traffic Tickets", "Company", "Adjust", "I", "II", "III", "IV", "Invoice Total", "Total", "Paid", "Balance"]}
            right={[17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35]}
            rows={q.data.rows.map((r) => [
              rental(r.id, r.raNumber), r.customerId ?? "", r.firstName, r.lastName, r.phone, r.email, r.reservationNumber ?? "", r.vehicle, r.vehicleType, r.pickupLocation,
              ymdhm(r.pickup), ymdhm(r.dateIn), r.returnLocation, r.status === "OPEN" ? "Open" : "Closed", r.openedBy, r.closedBy, ymdhm(r.closeDate), r.days,
              money(r.time), money(r.discount), money(r.mileage), money(r.fuel), money(r.upgrade), money(r.oneWay), money(r.damage), money(r.trafficTickets), r.company, money(r.adjust),
              ...r.other.map((o) => money(o)), money(r.invoiceTotal), money(r.total), money(r.paid), money(r.balance),
            ])}
            foot={["Total", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", t.days, money(t.time), money(t.discount), money(t.mileage), money(t.fuel), money(t.upgrade), money(t.oneWay), money(t.damage), money(t.trafficTickets), "", money(t.adjust), ...t.other.map((o) => money(o)), money(t.invoiceTotal), money(t.total), money(t.paid), money(t.balance)]}
          />
        </div>
      )}
    </ReportFrame>
  );
}

/** Rental Invoices (ReportsRentalInvoice.aspx). */
export function RentalInvoicesReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ locationId: "", from: "", to: "", type: "", balance: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.rentalInvoices.queryOptions({ locationId: run?.locationId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), type: (run?.type || "ALL") as "ALL", balance: (run?.balance || "ALL") as "ALL" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Rental Invoices" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="ri-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <DateField id="ri-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="ri-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="ri-ty" label="Rental Invoice Type" value={v.type} onChange={set("type")} options={[{ value: "INVOICE", label: "Invoice" }, { value: "CREDIT", label: "Credit Memo" }]} />
        <SelectFilter id="ri-ba" label="Balance" value={v.balance} onChange={set("balance")} options={[{ value: "ZERO", label: "0" }, { value: "OWING", label: "Owing" }]} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <ReportTable
          head={["Date", "Invoice #", "Invoice Type", "Customer", "Vehicle", "License#", "RA #", "Location", "Pickup Loc", "Pickup Date", "Return Loc", "Drop Off Date", "Total", "Pay./Credit.", "Balance"]}
          right={[12, 13, 14]}
          rows={q.data.rows.map((r) => [ymdhm(r.date), r.invoiceNumber, r.type, r.customer, r.vehicle, r.license, rental(r.rentalId, r.raNumber), r.location, r.pickupLocation, ymdhm(r.pickup), r.returnLocation, ymdhm(r.dropOff), money(r.total), money(r.paid), money(r.balance)])}
          foot={["Grand Total", "", "", "", "", "", "", "", "", "", "", "", money(q.data.totals.total), money(q.data.totals.paid), money(q.data.totals.balance)]}
        />
      )}
    </ReportFrame>
  );
}

/** Rental / Reservation Event Tracking (ReportsAgreementsEventLog / ReportsReservationsEventLog .aspx). */
function EventTracking({ kind }: { kind: "Rental" | "Reservation" }) {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ outFrom: "", outTo: "", inFrom: "", inTo: "", firstName: "", lastName: "", vehicleTypeId: "", ip: "", keyword: "", userId: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.eventTracking.queryOptions({
      kind, outFrom: fromDay(run?.outFrom ?? ""), outTo: fromDay(run?.outTo ?? ""), inFrom: fromDay(run?.inFrom ?? ""), inTo: fromDay(run?.inTo ?? ""),
      firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, vehicleTypeId: run?.vehicleTypeId, ip: run?.ip || undefined, keyword: run?.keyword || undefined,
      userId: run?.userId, locationId: run?.locationId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const base = kind === "Rental" ? "/admin/rentals" : "/admin/reservations";
  return (
    <ReportFrame title={`${kind} Event Tracking`} generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="et-of" label="Begin Date Out" value={v.outFrom} onChange={set("outFrom")} />
        <DateField id="et-ot" label="End Date Out" value={v.outTo} onChange={set("outTo")} />
        <DateField id="et-if" label="Date In Start" value={v.inFrom} onChange={set("inFrom")} />
        <DateField id="et-it" label="Date In End" value={v.inTo} onChange={set("inTo")} />
        {text("et-fn", "First Name", v.firstName, set("firstName"))}
        {text("et-ln", "Last Name", v.lastName, set("lastName"))}
        <SelectFilter id="et-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        {text("et-ip", "IP Address", v.ip, set("ip"))}
        {text("et-kw", "Keyword", v.keyword, set("keyword"))}
        <SelectFilter id="et-us" label="User" value={v.userId} onChange={set("userId")} options={f.agents} />
        <SelectFilter id="et-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <ReportTable
          head={["User", "IP", "Entered Date", kind === "Rental" ? "RA #" : "Res #", "FullName", "Change", "Old Value", "New Value"]}
          rows={q.data.map((r) => [r.user, r.ip, ymdhm(r.at), <Link key="b" className="text-primary hover:underline" href={`${base}/${r.bookingId}`}>{r.number}</Link>, r.fullName, r.field, r.oldValue, r.newValue])}
        />
      )}
    </ReportFrame>
  );
}
export const RentalEventTrackingReport = () => <EventTracking kind="Rental" />;
export const ReservationEventTrackingReport = () => <EventTracking kind="Reservation" />;
