"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

/** Revenue By Rate, Broker Commission, Sales Projection and Work In Process, as RentCentric's. */

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const rental = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link>;
const reservation = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/reservations/${id}`}>{n}</Link>;

/** Revenue By Rate (ReportsRateUsage.aspx). */
export function RevenueByRateReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ outFrom: "", outTo: "", inFrom: "", inTo: "", locationId: "", locationOutId: "", locationInId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.revenueByRate.queryOptions({
      outFrom: fromDay(run?.outFrom ?? ""), outTo: fromDay(run?.outTo ?? ""), inFrom: fromDay(run?.inFrom ?? ""), inTo: fromDay(run?.inTo ?? ""),
      locationId: run?.locationId, locationOutId: run?.locationOutId, locationInId: run?.locationInId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Rental#", "Pickup Date", "Return Date", "Days", "Hourly", "Daily", "Extra Daily", "Weekly", "Monthly", "Total"];
  return (
    <ReportFrame title="Revenue By Rate" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="rbr-of" label="Pickup Date Start" value={v.outFrom} onChange={set("outFrom")} />
        <DateField id="rbr-ot" label="Pickup Date End" value={v.outTo} onChange={set("outTo")} />
        <DateField id="rbr-if" label="Close Date Start" value={v.inFrom} onChange={set("inFrom")} />
        <DateField id="rbr-it" label="Close Date End" value={v.inTo} onChange={set("inTo")} />
        <SelectFilter id="rbr-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="rbr-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="rbr-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Pickup Date Start", run?.outFrom ?? ""], ["Pickup Date End", run?.outTo ?? ""], ["Close Date Start", run?.inFrom ?? ""], ["Close Date End", run?.inTo ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.rate}>
              <p className="mb-1 font-bold">{g.rate}</p>
              <ReportTable head={head} right={[3, 4, 5, 6, 7, 8, 9]}
                rows={g.rows.map((r) => [rental(r.id as string, r.raNumber as number), ymdhm(r.pickup as string), ymdhm(r.return as string), r.days as number, money(r.hourly as number), money(r.daily as number), money(r.extraDaily as number), money(r.weekly as number), money(r.monthly as number), money(r.total as number)])}
                foot={["Total", "", "", "", "", "", "", "", "", money(g.total)]} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.total)}</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Broker Commission (ReportsBrokerCommissionsLog.aspx). */
export function BrokerCommissionReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationId: "", companyId: "", userId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.brokerCommission.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, companyId: run?.companyId, userId: run?.userId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Broker Commission Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="bc-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="bc-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="bc-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="bc-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <SelectFilter id="bc-u" label="User" value={v.userId} onChange={set("userId")} options={f.agents} />
      </>}
      header={[["From", run?.from ?? ""], ["To", run?.to ?? ""], ["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && t && (
        <ReportTable head={["RA#", "Reservation#", "First Name", "Customer ID", "Last Name", "Pickup Date", "Return Date", "Days", "Vehicle", "Company", "User", "Total", "Disc.", "Total Amount"]} right={[7, 11, 12, 13]}
          rows={q.data.rows.map((r) => [rental(r.id, r.raNumber), r.reservationNumber ?? "", r.firstName, r.customerId, r.lastName, ymdhm(r.pickup), ymdhm(r.return), r.days, r.vehicle, r.company, r.user, money(r.total), money(r.discount), money(r.totalAmount)])}
          foot={["Total", "", "", "", "", "", "", "", "", "", "", money(t.total), money(t.discount), money(t.totalAmount)]} />
      )}
    </ReportFrame>
  );
}

const VEHICLE_STATUS = [{ value: "AUCTION", label: "Auction" }, { value: "AVAILABLE", label: "Available" }, { value: "HOLD_FOR_SALE", label: "Hold for Sale" }, { value: "ON_RENT", label: "On Rent" }];
const BOOKING_HEAD = ["Customer", "Vehicle ID", "Pickup Date", "Pickup Location", "Return Date", "Return Location", "Days", "T&M", "Others", "Ins.", "Misc.", "Taxes", "Total Amt."];
type Booking = { id: string; number: number; customer: string; vehicle: string; pickup: string | Date; pickupLocation: string; return: string | Date; returnLocation: string; days: number; tm: number; others: number; ins: number; misc: number; taxes: number; total: number };
type Totals = { tm: number; others: number; ins: number; misc: number; taxes: number; total: number };
const bookingRows = (xs: Booking[], link: (id: string, n: number) => React.ReactNode) =>
  xs.map((r) => [link(r.id, r.number), r.customer, r.vehicle, ymd(r.pickup), r.pickupLocation, ymd(r.return), r.returnLocation, r.days, money(r.tm), money(r.others), money(r.ins), money(r.misc), money(r.taxes), money(r.total)]);
const bookingFoot = (t: Totals) => ["Grand Total", "", "", "", "", "", "", "", money(t.tm), money(t.others), money(t.ins), money(t.misc), money(t.taxes), money(t.total)];

/** Sales Projection (ReportSalesProjection.aspx). */
export function SalesProjectionReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ outFrom: "", outTo: "", inFrom: "", inTo: "", makeId: "", vehicleTypeId: "", vehicleStatus: "", locationId: "", enteredBy: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.salesProjection.queryOptions({
      outFrom: fromDay(run?.outFrom ?? ""), outTo: fromDay(run?.outTo ?? ""), inFrom: fromDay(run?.inFrom ?? ""), inTo: fromDay(run?.inTo ?? ""), makeId: run?.makeId,
      vehicleTypeId: run?.vehicleTypeId, vehicleStatus: run?.vehicleStatus || undefined, locationId: run?.locationId, enteredBy: run?.enteredBy || undefined,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const d = q.data;
  return (
    <ReportFrame title="Sales Projection Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="sp-of" label="Pickup Date Start" value={v.outFrom} onChange={set("outFrom")} />
        <DateField id="sp-ot" label="Pickup Date End" value={v.outTo} onChange={set("outTo")} />
        <DateField id="sp-if" label="Return Date Start" value={v.inFrom} onChange={set("inFrom")} />
        <DateField id="sp-it" label="Return Date End" value={v.inTo} onChange={set("inTo")} />
        <SelectFilter id="sp-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} all="ALL" />
        <SelectFilter id="sp-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="sp-st" label="Status" value={v.vehicleStatus} onChange={set("vehicleStatus")} options={VEHICLE_STATUS} all="ALL" />
        <SelectFilter id="sp-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        {text("sp-eb", "Entered By", v.enteredBy, set("enteredBy"))}
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"], ["Pickup Date Start", run?.outFrom ?? ""], ["Pickup Date End", run?.outTo ?? ""]]}
    >
      {d && (
        <div className="space-y-5">
          <div>
            <p className="mb-1 font-bold">Rentals</p>
            <ReportTable head={["RA#", ...BOOKING_HEAD]} right={[7, 8, 9, 10, 11, 12, 13]} rows={bookingRows(d.rentals, rental)} foot={bookingFoot(d.rentalTotals)} />
            <p className="mt-1 font-semibold">Agreement Grand Total Amount: {money(d.rentalTotals.total)}</p>
          </div>
          <div>
            <p className="mb-1 font-bold">Reservations</p>
            <ReportTable head={["Res #", ...BOOKING_HEAD]} right={[7, 8, 9, 10, 11, 12, 13]} rows={bookingRows(d.reservations, reservation)} foot={bookingFoot(d.reservationTotals)} />
            <p className="mt-1 font-semibold">Reservation Grand Total Amount: {money(d.reservationTotals.total)}</p>
          </div>
          <div className="space-y-0.5 font-bold">
            <p>Agreements Grand Total: {money(d.rentalTotals.total)}</p>
            <p>Reservations Grand Total: {money(d.reservationTotals.total)}</p>
            <p>Sales Projections Amount: {money(d.projection)}</p>
          </div>
        </div>
      )}
    </ReportFrame>
  );
}

/** Work In Process (ReportsWorkInProgress.aspx). */
export function WorkInProcessReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", makeId: "", user: "", locationId: "", pickupLocationId: "", vehicleTypeId: "", companyId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.workInProcess.queryOptions({
      from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), makeId: run?.makeId, user: run?.user || undefined, locationId: run?.locationId, pickupLocationId: run?.pickupLocationId,
      vehicleTypeId: run?.vehicleTypeId, companyId: run?.companyId, status: (run?.status || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Rental#", "Customer", "Vehicle ID", "Pickup Date", "Pickup Location", "Return Date", "Return Location", "Daily Rate", "Days", "T&M", "Ins.", "Misc.", "Taxes", "Total"];
  return (
    <ReportFrame title="Work In Process" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="wip-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="wip-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="wip-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        {text("wip-u", "User ID", v.user, set("user"))}
        <SelectFilter id="wip-l" label="Owning Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="wip-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} />
        <SelectFilter id="wip-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="wip-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <SelectFilter id="wip-s" label="Status" value={v.status} onChange={set("status")} options={[{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }]} all="ALL" />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.pickupLocationId)?.name ?? "All"], ["Pickup Start Date", run?.from ?? ""], ["Pickup End Date", run?.to ?? ""], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.referral}>
              <p className="mb-1 font-bold">Referral: {g.referral}</p>
              <ReportTable head={head} right={[7, 8, 9, 10, 11, 12, 13]}
                rows={g.rows.map((r) => [rental(r.id as string, r.raNumber as number), r.customer as string, r.vehicle as string, ymd(r.pickup as string), r.pickupLocation as string, ymd(r.return as string), r.returnLocation as string, money(r.dailyRate as number), r.days as number, money(r.tm as number), money(r.ins as number), money(r.misc as number), money(r.taxes as number), money(r.total as number)])}
                foot={["Total", "", "", "", "", "", "", "", "", "", "", "", "", money(g.total)]} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.total)}</p>
        </div>
      )}
    </ReportFrame>
  );
}
