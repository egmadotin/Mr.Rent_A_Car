"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

/** Tasks, Commissions, Adjustment Details, Rental Days, Rental Discount and Customer Notes, as RentCentric's. */

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const rental = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link>;
const STATUS = [{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }];
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Tasks (ReportsTasks.aspx). */
export function TasksReport() {
  const trpc = useTRPC();
  const [v, setV] = React.useState({ from: "", to: "", subject: "", description: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.tasks.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), subject: run?.subject || undefined, description: run?.description || undefined }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Tasks" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="tk-f" label="Start Date" value={v.from} onChange={set("from")} />
        <DateField id="tk-t" label="End Date" value={v.to} onChange={set("to")} />
        {text("tk-s", "Subject", v.subject, set("subject"))}
        {text("tk-d", "Description", v.description, set("description"))}
      </>}
      header={[["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <ReportTable head={["DateEntered", "Date Closed", "Entered By", "Sent To", "Task Status", "Priority", "Subject"]}
          rows={q.data.map((t) => [ymd(t.dateEntered), ymd(t.dateClosed), t.enteredBy, t.sentTo, cap(t.status), cap(t.priority), t.subject])} />
      )}
    </ReportFrame>
  );
}

/** Consolidated Commission Report (ReportsCommissionsLog.aspx). */
export function CommissionsReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationId: "", agentId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.commissions.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, agentId: run?.agentId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Consolidated Commission Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="cm-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="cm-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="cm-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="cm-ag" label="Agent" value={v.agentId} onChange={set("agentId")} options={f.agents} />
      </>}
      header={[["From", run?.from ?? ""], ["To", run?.to ?? ""], ["Agent", f.agents.find((a) => a.id === run?.agentId)?.name ?? ""], ["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <ReportTable head={["RA#", "Reservation#", "Pickup Date", "Return Date", "Days", "Vehicle", "T&M", "Total", "Disc.", "Res.Comm.", "Open Comm.", "Close Comm.", "Walk In Comm.", "Total Comm."]}
          right={[4, 6, 7, 8, 9, 10, 11, 12, 13]}
          rows={q.data.rows.map((r) => [rental(r.id, r.raNumber), r.reservationNumber ?? "", ymdhm(r.pickup), ymdhm(r.return), r.days, r.vehicle, money(r.tm), money(r.total), money(r.discount), money(r.res), money(r.open), money(r.close), money(r.walkIn), money(r.totalComm)])}
          foot={["Total", "", "", "", "", "", money(q.data.totals.tm), money(q.data.totals.total), money(q.data.totals.discount), money(q.data.totals.res), money(q.data.totals.open), money(q.data.totals.close), money(q.data.totals.walkIn), money(q.data.totals.totalComm)]} />
      )}
    </ReportFrame>
  );
}

/** Adjustment Details (ReportsAdjustmentDetailsReport.aspx). */
export function AdjustmentDetailsReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ dateInFrom: "", dateInTo: "", adjustmentFrom: "", adjustmentTo: "", paymentFrom: "", paymentTo: "", locationOutId: "", locationInId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const d = (k: keyof typeof v) => fromDay(run?.[k] ?? "");
  const q = useQuery({
    ...trpc.staff.reports.adjustmentDetails.queryOptions({ dateInFrom: d("dateInFrom"), dateInTo: d("dateInTo"), adjustmentFrom: d("adjustmentFrom"), adjustmentTo: d("adjustmentTo"), paymentFrom: d("paymentFrom"), paymentTo: d("paymentTo"), locationOutId: run?.locationOutId, locationInId: run?.locationInId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Adjustment Details" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="ad-ia" label="Date In Start" value={v.dateInFrom} onChange={set("dateInFrom")} />
        <DateField id="ad-ib" label="Date In End" value={v.dateInTo} onChange={set("dateInTo")} />
        <DateField id="ad-aa" label="Adjustment Begin Date" value={v.adjustmentFrom} onChange={set("adjustmentFrom")} />
        <DateField id="ad-ab" label="Adjustment End Date" value={v.adjustmentTo} onChange={set("adjustmentTo")} />
        <DateField id="ad-pa" label="Payment Begin Date" value={v.paymentFrom} onChange={set("paymentFrom")} />
        <DateField id="ad-pb" label="Payment End Date" value={v.paymentTo} onChange={set("paymentTo")} />
        <SelectFilter id="ad-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="ad-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
      </>}
      header={[["Date In Start", run?.dateInFrom ?? ""], ["Date In End", run?.dateInTo ?? ""], ["Adjustment Begin Date", run?.adjustmentFrom ?? ""], ["Adjustment End Date", run?.adjustmentTo ?? ""]]}
    >
      {q.data && (
        <ReportTable head={["RA#", "Full Name", "Res#", "Vehicle", "Pickup Date", "Return Date", "Status", "Opened by", "Closed by", "Close Date", "Company", "Adjust Total", "Adjust Paid", "Adjust Balance"]}
          right={[11, 12, 13]}
          rows={q.data.rows.map((r) => [rental(r.id, r.raNumber), r.fullName, r.reservationNumber ?? "", r.vehicle, ymdhm(r.pickup), ymdhm(r.return), cap(r.status), r.openedBy, r.closedBy, ymdhm(r.closeDate), r.company, money(r.adjustTotal), money(r.adjustPaid), money(r.adjustBalance)])}
          foot={["Total", "", "", "", "", "", "", "", "", "", "", money(q.data.totals.adjustTotal), money(q.data.totals.adjustPaid), money(q.data.totals.adjustBalance)]} />
      )}
    </ReportFrame>
  );
}

/** Rental Days Report (ReportsRentalDays.aspx). */
export function RentalDaysReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", dateInFrom: "", dateInTo: "", locationOutId: "", locationInId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.rentalDays.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), dateInFrom: fromDay(run?.dateInFrom ?? ""), dateInTo: fromDay(run?.dateInTo ?? ""), locationOutId: run?.locationOutId, locationInId: run?.locationInId, status: (run?.status || "ALL") as "ALL" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Rental Days Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="rd-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="rd-t" label="End Date" value={v.to} onChange={set("to")} />
        <DateField id="rd-ia" label="Return Date Start" value={v.dateInFrom} onChange={set("dateInFrom")} />
        <DateField id="rd-ib" label="Return Date End" value={v.dateInTo} onChange={set("dateInTo")} />
        <SelectFilter id="rd-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="rd-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
        <SelectFilter id="rd-st" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="ALL" />
      </>}
      header={[["Return Date Start", run?.dateInFrom ?? ""], ["Return Date End", run?.dateInTo ?? ""]]}
    >
      {q.data && t && (
        <ReportTable head={["Rental#", "Full Name", "Vehicle", "Vehicle Type", "Location Out", "Date Out", "Date In", "Hours", "Hourly Rate", "Daily", "Daily Rate", "Weekly", "Weekly Rate", "Monthly", "Monthly Rate", "Total"]}
          right={[7, 8, 9, 10, 11, 12, 13, 14, 15]}
          rows={q.data.rows.map((r) => [rental(r.id, r.raNumber), r.fullName, r.vehicle, r.vehicleType, r.locationOut, ymdhm(r.dateOut), ymdhm(r.dateIn), r.hours, money(r.hourlyRate), r.daily, money(r.dailyRate), r.weekly, money(r.weeklyRate), r.monthly, money(r.monthlyRate), money(r.total)])}
          foot={["Total", "", "", "", "", "", "", t.hours, "", t.daily, "", t.weekly, "", t.monthly, "", money(t.total)]} />
      )}
    </ReportFrame>
  );
}

/** Rental Discount (ReportsRentalDiscount.aspx): discounts added / changed / removed on rentals. */
export function RentalDiscountReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationOutId: "", locationInId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.rentalDiscount.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationOutId: run?.locationOutId, locationInId: run?.locationInId, status: (run?.status || "ALL") as "ALL" }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Rental Discount" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="rdc-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="rdc-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="rdc-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="rdc-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
        <SelectFilter id="rdc-st" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="ALL" />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <ReportTable head={["RANumber", "Customer Name", "Action", "Old Value", "New Value", "Date", "Admin"]}
          rows={q.data.map((r) => [rental(r.rentalId, r.raNumber), r.customer, r.action, r.oldValue, r.newValue, ymdhm(r.date), r.admin])} />
      )}
    </ReportFrame>
  );
}

/** Customer Notes (ReportsCustomerNotes.aspx): notes grouped by customer, then the grand total. */
export function CustomerNotesReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ customerId: "", firstName: "", lastName: "", city: "", address: "", phone: "", keyword: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.customerNotes.queryOptions({
      customerId: run?.customerId ? Number(run.customerId) : undefined, firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, city: run?.city || undefined,
      address: run?.address || undefined, phone: run?.phone || undefined, keyword: run?.keyword || undefined, locationId: run?.locationId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Notes" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        {text("cn-id", "Customer ID", v.customerId, set("customerId"))}
        {text("cn-fn", "First Name", v.firstName, set("firstName"))}
        {text("cn-ln", "Last Name", v.lastName, set("lastName"))}
        {text("cn-ci", "City", v.city, set("city"))}
        {text("cn-ad", "Address", v.address, set("address"))}
        {text("cn-ph", "Phone", v.phone, set("phone"))}
        {text("cn-kw", "Note Keyword", v.keyword, set("keyword"))}
        <SelectFilter id="cn-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.map((g) => (
            <div key={g.customerId}>
              <p className="mb-1 font-bold">
                <Link className="text-primary hover:underline" href={`/admin/customers/${g.customerId}`}>{g.name}</Link>
                {g.legacyId != null && <span className="font-normal"> · #{g.legacyId}</span>}
                {g.phone && <span className="font-normal"> · {g.phone}</span>}
              </p>
              <ReportTable head={["Date", "Entered By", "Note"]} rows={g.notes.map((n) => [ymdhm(n.date), n.by, <span key="n" className="whitespace-pre-wrap">{n.note}</span>])} />
            </div>
          ))}
          <p className="font-bold">{q.data.count} Grand Total</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Checklist Overview Report (ReportsChecklistOverview.aspx): vehicle checklists by Date Out, with their ticked items. */
export function ChecklistOverviewReport() {
  const trpc = useTRPC();
  const [v, setV] = React.useState({ from: "", to: "", assignedId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.checklists.overview.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), assignedId: run?.assignedId || undefined }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Checklist Overview Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="co-f" label="Date Out - From" value={v.from} onChange={set("from")} />
        <DateField id="co-t" label="To" value={v.to} onChange={set("to")} />
        {text("co-v", "Vehicle ID", v.assignedId, set("assignedId"))}
      </>}
      header={[["Date Out - From", run?.from ?? ""], ["To", run?.to ?? ""]]}
    >
      {q.data && (
        <ReportTable head={["Pickup Date", "Return Date", "Mileage", "Delivery/PickUp", "Vehicle ID", "Reservation#", "Full Name", "Checklist"]}
          right={[2]}
          rows={q.data.map((r) => [
            ymdhm(r.pickupAt), ymdhm(r.returnAt), r.mileage?.toLocaleString() ?? "", r.deliveryOrPickup === "DELIVERY" ? "Delivery" : "PickUp",
            <Link key="v" className="text-primary hover:underline" href={`/admin/vehicles/${r.vehicleId}`}>{r.assignedId}</Link>,
            r.reservationId ? <Link key="r" className="text-primary hover:underline" href={`/admin/reservations/${r.reservationId}`}>{r.reservationNumber}</Link> : "",
            r.fullName,
            <span key="c" className="text-xs">{r.items.map((i) => `${i.checked ? "✓" : "✗"} ${i.name}${i.note ? ` (${i.note})` : ""}`).join(" · ")}</span>,
          ])} />
      )}
    </ReportFrame>
  );
}

/** Promo Code (PromoCodeReport.aspx): reservations booked with a promo code, by usage (booking) date. */
export function PromoCodeReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationId: "", category: "", code: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.promoCodes.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationIds: run?.locationId ? [run.locationId] : [], category: (run?.category ?? "") as "", code: run?.code || undefined }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Promo Codes" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="pc-f" label="Usage Start Date" value={v.from} onChange={set("from")} />
        <DateField id="pc-t" label="Usage End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="pc-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="pc-ca" label="Category" value={v.category} onChange={set("category")} options={[{ value: "RESERVATION", label: "Reservation" }, { value: "REGISTRATION", label: "Registration" }]} all="- Select -" />
        {text("pc-co", "Promotion Code", v.code, set("code"))}
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <ReportTable head={["First Name", "Last Name", "Promo Code", "Res.#", "Rental #", "Pickup Date", "Return Date", "Res.Total", "Rental Subtotal", "Rental Total", "Date", "Discount", "Discount Total"]}
          right={[7, 8, 9, 12]}
          rows={q.data.rows.map((r) => [
            r.firstName, r.lastName, r.code,
            <Link key="s" className="text-primary hover:underline" href={`/admin/reservations/${r.id}`}>{r.reservationNumber}</Link>,
            r.rentalId && r.raNumber != null ? rental(r.rentalId, r.raNumber) : "",
            ymdhm(r.pickup), ymdhm(r.return), money(r.resTotal), r.rentalSubtotal != null ? money(r.rentalSubtotal) : "", r.rentalTotal != null ? money(r.rentalTotal) : "",
            ymdhm(r.date), r.discount, money(r.discountTotal),
          ])}
          foot={["Total", "", "", "", "", "", "", "", "", "", "", "", money(q.data.totals.discountTotal)]} />
      )}
    </ReportFrame>
  );
}
