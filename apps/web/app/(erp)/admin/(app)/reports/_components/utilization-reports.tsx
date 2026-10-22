"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

/** Fleet Utilization History / For Cast / Snapshot and Snap Shot For Rentals / Vehicle Type, as RentCentric's. */

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const vehicle = (id: string, label: string) => <Link key="v" className="text-primary hover:underline" href={`/admin/vehicles/${id}`}>{label}</Link>;
const ACTIVE = [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }];
const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Fleet Utilization History (ReportsFleetUtilization3.aspx). */
export function FleetUtilizationHistoryReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", outFrom: "", outTo: "", inFrom: "", inTo: "", from: "", to: "", locationId: "", owningLocationId: "", currentLocationId: "", vehicleTypeId: "", active: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.fleetUtilizationHistory.queryOptions({
      from: fromDay(run?.from ?? "") ?? new Date(), to: fromDay(run?.to ?? "") ?? new Date(), makeId: run?.makeId, outFrom: fromDay(run?.outFrom ?? ""), outTo: fromDay(run?.outTo ?? ""),
      inFrom: fromDay(run?.inFrom ?? ""), inTo: fromDay(run?.inTo ?? ""), locationId: run?.locationId, owningLocationId: run?.owningLocationId, currentLocationId: run?.currentLocationId,
      vehicleTypeId: run?.vehicleTypeId, active: (run?.active || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Assigned ID", "Year Model", "Infleet Days", "Total Days Rented", "Utilization", "Total Time Income", "Total Mileage Income", "Total Billed"];
  return (
    <ReportFrame title="Fleet Utilization History" generated={!!run} onGenerate={() => (v.from && v.to ? setRun({ ...v }) : alert("Please select Begin Date and End Date."))} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="fuh-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <DateField id="fuh-of" label="Begin Date Out" value={v.outFrom} onChange={set("outFrom")} />
        <DateField id="fuh-ot" label="End Date Out" value={v.outTo} onChange={set("outTo")} />
        <DateField id="fuh-if" label="Begin Date In" value={v.inFrom} onChange={set("inFrom")} />
        <DateField id="fuh-it" label="End Date In" value={v.inTo} onChange={set("inTo")} />
        <DateField id="fuh-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="fuh-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="fuh-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="fuh-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="fuh-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="fuh-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="fuh-a" label="Active" value={v.active} onChange={set("active")} options={ACTIVE} />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.map((g) => (
            <div key={g.type}>
              <p className="mb-1 font-bold">Vehicle Type: {g.type}</p>
              <ReportTable head={head} right={[2, 3, 4, 5, 6, 7]}
                rows={g.rows.map((r) => [vehicle(r.id as string, r.assignedId as string), (r.year as number | null) ?? "", r.infleet as number, r.rented as number, `${r.utilization as number}%`, money(r.time as number), money(r.mileage as number), money(r.billed as number)])}
                foot={["Total", "", g.totals.infleet, g.totals.rented, `${g.totals.utilization}%`, money(g.totals.time), money(g.totals.mileage), money(g.totals.billed)]} />
            </div>
          ))}
        </div>
      )}
    </ReportFrame>
  );
}

/** Fleet Utilization For Cast (ReportsFleetUtilizationForCast.aspx). */
export function FleetUtilizationForecastReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ locationId: "", vehicleTypeId: "", from: "", to: "", active: "ACTIVE" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.fleetUtilizationForecast.queryOptions({
      from: fromDay(run?.from ?? "") ?? new Date(), to: fromDay(run?.to ?? "") ?? new Date(), locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId, active: (run?.active || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Fleet Utilization Forecast" generated={!!run} onGenerate={() => (v.from && v.to ? setRun({ ...v }) : alert("Please select Begin Date and End Date."))} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="fuf-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="fuf-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <DateField id="fuf-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="fuf-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="fuf-a" label="Active" value={v.active} onChange={set("active")} options={ACTIVE} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.map((d) => (
            <div key={String(d.date)}>
              <p className="mb-1 font-bold">{ymd(d.date)} — Utilization {d.utilization}%</p>
              <ReportTable head={["Vehicle Type", "Fleet", "On Rent", "Reserved", "Available", "Utilization"]} right={[1, 2, 3, 4, 5]}
                rows={d.rows.map((r) => [r.type, r.fleet, r.onRent, r.reserved, r.available, `${r.utilization}%`])} />
            </div>
          ))}
        </div>
      )}
    </ReportFrame>
  );
}

/** Snap Shot For Rentals / Vehicle Type (ReportsSnapShot.aspx). */
export function SnapShotReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", makeId: "", user: "", locationId: "", currentLocationId: "", vehicleTypeId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.snapShot.queryOptions({
      from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), makeId: run?.makeId, user: run?.user || undefined, locationId: run?.locationId, currentLocationId: run?.currentLocationId,
      vehicleTypeId: run?.vehicleTypeId, status: (run?.status || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Vehicle ID", "Make", "Model", "Rental #", "Pickup Date", "Loc.Out", "Return Date", "Loc In"];
  return (
    <ReportFrame title="Snap Shot For Rentals / Vehicle Type" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="ss-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="ss-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="ss-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        {text("ss-u", "User ID", v.user, set("user"))}
        <SelectFilter id="ss-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="ss-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="ss-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="ss-s" label="Status" value={v.status} onChange={set("status")} options={[{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }]} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.type}>
              <p className="mb-1 font-bold">{g.type}</p>
              <ReportTable head={head}
                rows={g.rows.map((r) => [vehicle(r.vehicleId as string, r.assignedId as string), r.make as string, r.model as string, <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${r.id as string}`}>{r.raNumber as number}</Link>, ymdhm(r.pickup as string), r.locOut as string, ymdhm(r.return as string), r.locIn as string])}
                foot={["Total", "", "", g.rows.length, "", "", "", ""]} />
            </div>
          ))}
          <p className="font-bold">Grand Total {q.data.total}</p>
        </div>
      )}
    </ReportFrame>
  );
}

const SNAP_STATUS = [{ value: "AUCTION", label: "Auction" }, { value: "AVAILABLE", label: "Available" }, { value: "HOLD_FOR_SALE", label: "Hold for Sale" }, { value: "ON_RENT", label: "On Rent" }];

/** Fleet Utilization Snapshot (ReportsFleetUtilizationSnapShot.aspx). */
export function FleetSnapshotReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ status: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.fleetSnapshot.queryOptions({ status: run?.status || undefined, locationId: run?.locationId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Fleet Utilization Snapshot" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="fs-s" label="Status" value={v.status} onChange={set("status")} options={SNAP_STATUS} all="Please Select" />
        <SelectFilter id="fs-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <ReportTable head={["VINNumber", "Current Location", "Assigned ID", "Odometer", "Status", "Date of Return", "Customer", "Phone #"]} right={[3]}
          rows={q.data.rows.map((r) => [r.vin, r.location, vehicle(r.id, r.assignedId), r.odometer ?? "", titleCase(r.status), ymdhm(r.returnDate), r.customer, r.phone])}
          foot={["Grand Total", q.data.total, "", "", "", "", "", ""]} />
      )}
    </ReportFrame>
  );
}
