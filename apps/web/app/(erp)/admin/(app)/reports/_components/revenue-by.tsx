"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@mrac/api";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd } from "./report-kit";

type Grouped = RouterOutputs["staff"]["reports"]["revenueByCustomer"];
type Row = Grouped["groups"][number]["rows"][number];
const ra = (r: Row) => <Link key="ra" className="text-primary hover:underline" href={`/admin/rentals/${r.id}`}>{r.raNumber}</Link>;
const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);

/** Grouped body: a heading per group, its rows, a subtotal; then the Grand Total. */
function GroupedBody({ data, head, cells, right, totalCol }: { data: Grouped; head: string[]; cells: (r: Row) => React.ReactNode[]; right: number[]; totalCol: number }) {
  const footFor = (label: string, total: number) => head.map((_, i) => (i === 0 ? label : i === totalCol ? money(total) : ""));
  return (
    <div className="space-y-4">
      {data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
      {data.groups.map((g) => (
        <div key={g.name}>
          <p className="mb-1 font-bold">{g.name}</p>
          <ReportTable head={head} right={right} rows={g.rows.map(cells)} foot={footFor(`Total (${g.rows.length})`, g.total)} />
        </div>
      ))}
      <p className="font-bold">Grand Total: {money(data.total)} · {data.count} rental{data.count === 1 ? "" : "s"}</p>
    </div>
  );
}

/** Revenue By Customer (ReportsCustomerRevenue.aspx). */
export function RevenueByCustomerReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ pickupFrom: "", pickupTo: "", dateInFrom: "", dateInTo: "", firstName: "", lastName: "", locationId: "", owningLocationId: "", status: "ALL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.revenueByCustomer.queryOptions({
      pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), dateInFrom: fromDay(run?.dateInFrom ?? ""), dateInTo: fromDay(run?.dateInTo ?? ""),
      firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, locationId: run?.locationId, owningLocationId: run?.owningLocationId, status: (run?.status ?? "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Revenue By Customer"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="rc-pf" label="Pickup Date - From" value={v.pickupFrom} onChange={set("pickupFrom")} />
          <DateField id="rc-pt" label="To" value={v.pickupTo} onChange={set("pickupTo")} />
          <DateField id="rc-if" label="Date In - From" value={v.dateInFrom} onChange={set("dateInFrom")} />
          <DateField id="rc-it" label="To" value={v.dateInTo} onChange={set("dateInTo")} />
          {text("rc-fn", "First Name", v.firstName, set("firstName"))}
          {text("rc-ln", "Last Name", v.lastName, set("lastName"))}
          <SelectFilter id="rc-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
          <SelectFilter id="rc-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
          <SelectFilter id="rc-st" label="Status" value={v.status} onChange={set("status")} options={[{ value: "ALL", label: "All" }, { value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }]} all={false} />
        </>
      }
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Start Date", run?.pickupFrom || run?.dateInFrom || ""], ["End Date", run?.pickupTo || run?.dateInTo || ""]]}
    >
      {q.data && (
        <GroupedBody
          data={q.data}
          head={["Rental#", "Vehicle ID", "Model", "Pickup Date", "Return Date", "Days", "Insurance", "Misc.", "Total", "OdometerOut", "OdometerIn"]}
          right={[5, 6, 7, 8, 9, 10]}
          totalCol={8}
          cells={(r) => [ra(r), r.vehicleId, r.model, ymd(r.pickup), ymd(r.returnDate), r.days, money(r.insurance), money(r.misc), money(r.total), r.odOut, r.odIn ?? ""]}
        />
      )}
    </ReportFrame>
  );
}

/** Revenue By Vehicle (ReportsVehicleRevenue.aspx). */
export function RevenueByVehicleReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const years = React.useMemo(() => Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() + 3 - i)).map((y) => ({ value: y, label: y })), []);
  const [v, setV] = React.useState({ assignedId: "", makeId: "", year: "", pickupFrom: "", pickupTo: "", dateInFrom: "", dateInTo: "", customer: "", locationId: "", vehicleTypeId: "", vehicleStatus: "ALL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.revenueByVehicle.queryOptions({
      assignedId: run?.assignedId || undefined, makeId: run?.makeId, year: run?.year ? Number(run.year) : undefined,
      pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), dateInFrom: fromDay(run?.dateInFrom ?? ""), dateInTo: fromDay(run?.dateInTo ?? ""),
      customer: run?.customer || undefined, locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId, vehicleStatus: (run?.vehicleStatus ?? "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Revenue By Vehicle"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          {text("rv-id", "Vehicle ID", v.assignedId, set("assignedId"))}
          <SelectFilter id="rv-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
          <SelectFilter id="rv-yr" label="Year" value={v.year} onChange={set("year")} options={years} all="" />
          {text("rv-cu", "Customer", v.customer, set("customer"))}
          <DateField id="rv-pf" label="Pickup Date - From" value={v.pickupFrom} onChange={set("pickupFrom")} />
          <DateField id="rv-pt" label="To" value={v.pickupTo} onChange={set("pickupTo")} />
          <DateField id="rv-if" label="Date In - From" value={v.dateInFrom} onChange={set("dateInFrom")} />
          <DateField id="rv-it" label="To" value={v.dateInTo} onChange={set("dateInTo")} />
          <SelectFilter id="rv-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
          <SelectFilter id="rv-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
          <SelectFilter id="rv-st" label="Status" value={v.vehicleStatus} onChange={set("vehicleStatus")} options={[{ value: "ALL", label: "All" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} all={false} />
        </>
      }
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? ""], ["Close Start Date", run?.dateInFrom ?? ""], ["Close End Date", run?.dateInTo ?? ""]]}
    >
      {q.data && (
        <GroupedBody
          data={q.data}
          head={["Rental#", "Pickup Date", "Return Date", "Odo. Out", "Odo. In", "Days", "Time", "Mileage", "Fuel Charge", "Total"]}
          right={[3, 4, 5, 6, 7, 8, 9]}
          totalCol={9}
          cells={(r) => [ra(r), ymd(r.pickup), ymd(r.returnDate), r.odOut, r.odIn ?? "", r.days, money(r.time), money(r.mileage), money(r.fuel), money(r.total)]}
        />
      )}
    </ReportFrame>
  );
}

/** Revenue By Location (ReportsLocationRevenue.aspx). */
export function RevenueByLocationReport() {
  const trpc = useTRPC();
  const [v, setV] = React.useState({ pickupFrom: "", pickupTo: "", returnFrom: "", returnTo: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.revenueByLocation.queryOptions({ pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? "") }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Revenue By Location"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="rl-pf" label="Pickup Date - From" value={v.pickupFrom} onChange={set("pickupFrom")} />
          <DateField id="rl-pt" label="To" value={v.pickupTo} onChange={set("pickupTo")} />
          <DateField id="rl-rf" label="Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="rl-rt" label="To" value={v.returnTo} onChange={set("returnTo")} />
        </>
      }
      header={[["Pickup Start Date", run?.pickupFrom ?? ""], ["Pickup End Date", run?.pickupTo ?? ""], ["Return Start Date", run?.returnFrom ?? ""], ["Return End Date", run?.returnTo ?? ""]]}
    >
      {q.data && (
        <GroupedBody
          data={q.data}
          head={["Rental#", "First Name", "Last Name", "Pickup Date", "Return Date", "Days", "Vehicle ID", "Model", "Balance", "Total"]}
          right={[5, 8, 9]}
          totalCol={9}
          cells={(r) => [ra(r), r.firstName, r.lastName, ymd(r.pickup), ymd(r.returnDate), r.days, r.vehicleId, r.model, money(r.balance), money(r.total)]}
        />
      )}
    </ReportFrame>
  );
}

/** Revenue By Company (ReportsRevenueByCompany.aspx): Full Report or Commission. */
export function RevenueByCompanyReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ companyId: "", returnFrom: "", returnTo: "", mode: "FULL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.revenueByCompany.queryOptions({ companyId: run?.companyId, returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""), mode: (run?.mode ?? "FULL") as "FULL" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Revenue By Company"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <SelectFilter id="rco-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} all="ALL" />
          <DateField id="rco-rf" label="Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="rco-rt" label="To" value={v.returnTo} onChange={set("returnTo")} />
          <SelectFilter id="rco-m" label="Report" value={v.mode} onChange={set("mode")} options={[{ value: "FULL", label: "Full Report" }, { value: "COMMISSION", label: "Commission" }]} all={false} />
        </>
      }
      header={[["Company", f.companies.find((c) => c.id === run?.companyId)?.name ?? "All"], ["Close Date", run?.returnFrom ?? ""], ["Close Date End", run?.returnTo ?? ""]]}
    >
      {q.data && (
        <ReportTable
          head={["Rental#", "Company Name", "Full Name", "Pickup Location", "Return Location", "Vehicle Type", "Pickup Date", "Return Date", "Total", "Commission"]}
          right={[8, 9]}
          rows={q.data.rows.map((r) => [ra(r), r.company, r.customer, r.locOut, r.locIn, r.vehicleType, ymd(r.pickup), ymd(r.returnDate), money(r.total), money(r.commission)])}
          foot={["Grand Total", String(q.data.rows.length), "", "", "", "", "", "", money(q.data.total), money(q.data.commission)]}
        />
      )}
    </ReportFrame>
  );
}
