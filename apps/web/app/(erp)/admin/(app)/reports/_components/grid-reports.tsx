"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, useReportFilters, ymd, ymdhm } from "./report-kit";

/** Vehicles Summary with QR Code, Fleet Grid, Reservation Grid and Reservation Forecast, as RentCentric's. */

const ACTIVE = [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }];
const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const dayHead = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { month: "2-digit", day: "2-digit", weekday: "short" });
const needDates = (v: { from: string; to: string }, go: () => void) => (v.from && v.to ? go() : alert("Please select Begin Date and End Date."));

const QR_STATUS = [{ value: "AUCTION", label: "Auction" }, { value: "AVAILABLE", label: "Available" }, { value: "HOLD_FOR_SALE", label: "Hold for Sale" }, { value: "ON_RENT", label: "On Rent" }];
const ORDER = [
  { value: "MAKE", label: "Make" }, { value: "MODEL", label: "Model" }, { value: "VEHICLE_ID", label: "VehicleID" }, { value: "YEAR", label: "Year" },
  { value: "STATUS", label: "Status" }, { value: "TYPE", label: "VehicleType" }, { value: "OUT_OF_SERVICE", label: "Out Of Service Date" },
];

/** Vehicles Summary with QR Code (ReportsVehicleListWithQRCode.aspx). */
export function VehiclesQrReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", year: "", status: "", owningLocationId: "", locationId: "", currentLocationId: "", vehicleTypeId: "", orderBy: "", active: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehiclesQr.queryOptions({
      makeId: run?.makeId, year: run?.year ? Number(run.year) : undefined, status: run?.status || undefined, owningLocationId: run?.owningLocationId, locationId: run?.locationId,
      currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId, orderBy: (run?.orderBy || "NONE") as "NONE", active: (run?.active || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Vehicle Summary" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vq-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <div className="space-y-1"><Label htmlFor="vq-y">Year Made</Label><Input id="vq-y" inputMode="numeric" value={v.year} onChange={(e) => set("year")(e.target.value)} /></div>
        <SelectFilter id="vq-s" label="Status" value={v.status} onChange={set("status")} options={QR_STATUS} />
        <SelectFilter id="vq-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="vq-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vq-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="vq-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="vq-o" label="Order By" value={v.orderBy} onChange={set("orderBy")} options={ORDER} all="None" />
        <SelectFilter id="vq-a" label="Active" value={v.active} onChange={set("active")} options={ACTIVE} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-5">
          {q.data.groups.map((g) => (
            <div key={g.type}>
              <p className="mb-2 font-bold">Vehicle Type: {g.type} ({g.rows.length})</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {g.rows.map((r) => (
                  <div key={r.id} className="flex flex-col items-center rounded border p-2 text-center text-xs break-inside-avoid">
                    {/* SVG made server-side by the qrcode library from the Assigned ID */}
                    <div className="size-24 bg-white" dangerouslySetInnerHTML={{ __html: r.qr }} />
                    <Link className="mt-1 font-bold text-primary hover:underline" href={`/admin/vehicles/${r.id}`}>{r.assignedId}</Link>
                    <span>{r.vehicle}</span>
                    <span className="text-muted-foreground">{r.plate} · {titleCase(r.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="font-bold">Grand Total {q.data.total}</p>
        </div>
      )}
    </ReportFrame>
  );
}

function GridReport({ kind, title }: { kind: "FLEET" | "RESERVATION"; title: string }) {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ locationId: "", vehicleTypeId: "", from: "", to: "", active: "ACTIVE", noShowPercent: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.bookingGrid.queryOptions({
      kind, from: fromDay(run?.from ?? "") ?? new Date(), to: fromDay(run?.to ?? "") ?? new Date(), locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId,
      active: (run?.active || "ALL") as "ALL", noShowPercent: Number(run?.noShowPercent || 0),
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const d = q.data;
  return (
    <ReportFrame title={title} generated={!!run} onGenerate={() => needDates(v, () => setRun({ ...v }))} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id={`${kind}-l`} label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id={`${kind}-vt`} label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <DateField id={`${kind}-f`} label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id={`${kind}-t`} label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id={`${kind}-a`} label="Active" value={v.active} onChange={set("active")} options={ACTIVE} />
        {kind === "FLEET" && (
          <div className="space-y-1"><Label htmlFor="FLEET-ns">No Show %</Label><Input id="FLEET-ns" inputMode="decimal" value={v.noShowPercent} onChange={(e) => set("noShowPercent")(e.target.value)} /></div>
        )}
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"]]}
    >
      {d && (
        <ReportTable head={["Vehicle Type", ...(kind === "FLEET" ? ["Fleet"] : []), ...d.days.map(dayHead)]} right={d.days.map((_, i) => i + (kind === "FLEET" ? 2 : 1)).concat(kind === "FLEET" ? [1] : [])}
          rows={d.rows.map((r) => [r.type, ...(kind === "FLEET" ? [r.fleet] : []), ...r.cells.map((c, i) => <span key={i} className={c < 0 ? "font-bold text-destructive" : undefined}>{c}</span>)])}
          foot={["Total", ...(kind === "FLEET" ? [d.rows.reduce((a, r) => a + r.fleet, 0)] : []), ...d.totals]} />
      )}
    </ReportFrame>
  );
}

/** Fleet Grid (ReportsFleetGrid.aspx). */
export const FleetGridReport = () => <GridReport kind="FLEET" title="Fleet Grid" />;
/** Reservation Grid (ReportsReservationGrid.aspx). */
export const ReservationGridReport = () => <GridReport kind="RESERVATION" title="Reservation Grid" />;

/** Reservation Forecast (ReportsReservationForcast.aspx). */
export function ReservationForecastReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ locationId: "", vehicleTypeId: "", from: "", to: "", active: "ACTIVE", summary: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.reservationForecast.queryOptions({
      from: fromDay(run?.from ?? "") ?? new Date(), to: fromDay(run?.to ?? "") ?? new Date(), locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId,
      active: (run?.active || "ALL") as "ALL", summary: (run?.summary || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Reservation Forecast" generated={!!run} onGenerate={() => needDates(v, () => setRun({ ...v }))} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="rf-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="rf-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <DateField id="rf-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="rf-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="rf-a" label="Active" value={v.active} onChange={set("active")} options={ACTIVE} />
        <SelectFilter id="rf-s" label="Summary" value={v.summary} onChange={set("summary")} options={[{ value: "BY_RESERVATION", label: "By Reservation" }]} all="ALL" />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.map((d) => (
            <div key={String(d.date)}>
              <p className="mb-1 font-bold">{ymd(d.date)} — Pickups {d.pickups} · Returns {d.returns}</p>
              <ReportTable head={["Vehicle Type", "Pickups", "Returns", "Net"]} right={[1, 2, 3]} rows={d.rows.map((r) => [r.type, r.pickups, r.returns, r.net])} />
              {d.reservations.length > 0 && (
                <div className="mt-2">
                  <ReportTable head={["Res #", "Customer", "Vehicle Type", "Pickup Date", "Pickup Location", "Return Date", "Return Location"]}
                    rows={d.reservations.map((r) => [<Link key="r" className="text-primary hover:underline" href={`/admin/reservations/${r.id}`}>{r.number}</Link>, r.customer, r.type, ymdhm(r.pickup), r.pickupLocation, ymdhm(r.return), r.returnLocation])} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ReportFrame>
  );
}
