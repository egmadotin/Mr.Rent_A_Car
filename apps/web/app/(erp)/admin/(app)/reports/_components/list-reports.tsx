"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

const METHOD: Record<string, string> = { AMEX: "Amex", CASH: "Cash", DEBIT: "Debit", EMT: "EMT", INTERNAL: "Internal", MASTERCARD: "Mastercard", VISA: "Visa" };
const TYPE: Record<string, string> = { PAYMENT: "Payment", AUTHORIZATION: "Authorization", REFUND: "Refund" };
const locName = (f: ReturnType<typeof useReportFilters>, id?: string) => (id ? f.locations.find((l) => l.id === id)?.name ?? "" : "All");

/** Daily Cash Summary (ReportsDCS.aspx). */
export function DailyCashReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ date: "", from: "", to: "", owningLocationId: "", pickupLocationId: "", returnLocationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.dailyCash.queryOptions({ date: fromDay(run?.date ?? ""), from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), owningLocationId: run?.owningLocationId, pickupLocationId: run?.pickupLocationId, returnLocationId: run?.returnLocationId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Daily Cash Summary"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="dc-d" label="Date (One Day)" value={v.date} onChange={set("date")} />
          <DateField id="dc-f" label="Date - From" value={v.from} onChange={set("from")} />
          <DateField id="dc-t" label="To (max 31 days)" value={v.to} onChange={set("to")} />
          <div />
          <SelectFilter id="dc-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
          <SelectFilter id="dc-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} />
          <SelectFilter id="dc-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} />
        </>
      }
      header={[["Loc", locName(f, run?.owningLocationId)], ["Pickup Location", locName(f, run?.pickupLocationId)], ["Return Location", locName(f, run?.returnLocationId)], ["For", run?.date || `${run?.from ?? ""} to ${run?.to ?? ""}`]]}
    >
      {q.data && (
        <ReportTable
          head={["Rental#", "Reservation#", "Full Name", "Amount", "Type", "Payment Method", "Date", "Taken By", "RA Pickup Date", "Res Pickup Date", "Pickup Location", "Company"]}
          right={[3]}
          rows={q.data.rows.map((r) => [r.raNumber ?? "", r.reservationNumber ?? "", r.fullName, money(r.amount), TYPE[r.type], METHOD[r.method] ?? r.method, ymdhm(r.date), r.takenBy, ymd(r.raPickup), ymd(r.resPickup), r.pickupLocation, r.company])}
          foot={["Grand Total", "", "", money(q.data.grandTotal), "", "", "", "", "", "", "", ""]}
        />
      )}
    </ReportFrame>
  );
}

/** Rental Status (ReportsAgreementStatus.aspx). */
export function RentalStatusReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ pickupFrom: "", pickupTo: "", returnFrom: "", returnTo: "", makeId: "", owningLocationId: "", pickupLocationId: "", returnLocationId: "", vehicleTypeId: "", status: "ALL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.rentalStatus.queryOptions({
      pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""),
      makeId: run?.makeId, owningLocationId: run?.owningLocationId, pickupLocationId: run?.pickupLocationId, returnLocationId: run?.returnLocationId, vehicleTypeId: run?.vehicleTypeId, status: (run?.status ?? "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Rental Status"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="rs-pf" label="Rental Pickup Date - From" value={v.pickupFrom} onChange={set("pickupFrom")} />
          <DateField id="rs-pt" label="to" value={v.pickupTo} onChange={set("pickupTo")} />
          <DateField id="rs-rf" label="Rental Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="rs-rt" label="to" value={v.returnTo} onChange={set("returnTo")} />
          <SelectFilter id="rs-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} all="Please Select" />
          <SelectFilter id="rs-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
          <SelectFilter id="rs-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} />
          <SelectFilter id="rs-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} />
          <SelectFilter id="rs-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
          <SelectFilter id="rs-st" label="Status" value={v.status} onChange={set("status")} options={[{ value: "ALL", label: "ALL" }, { value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }]} all={false} />
        </>
      }
      header={[["Location", locName(f, run?.owningLocationId)], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? ""], ["Pickup Date Start", run?.pickupFrom ?? ""], ["Pickup Date End", run?.pickupTo ?? ""], ["Return Date Start", run?.returnFrom ?? ""], ["Return Date End", run?.returnTo ?? ""]]}
    >
      {q.data && (
        <ReportTable
          head={["Rental#", "Vehicle ID", "Model", "First Name", "Last Name", "Pickup Date", "Od.Out", "Loc.Out", "Return Date", "Od.In", "Loc.In", "Days"]}
          right={[6, 9, 11]}
          rows={q.data.map((r) => [<Link key="ra" className="text-primary hover:underline" href={`/admin/rentals/${r.id}`}>{r.raNumber}</Link>, r.vehicleId, r.model, r.firstName, r.lastName, ymdhm(r.pickup), r.odOut, r.locOut, ymdhm(r.returnDate), r.odIn ?? "", r.locIn, r.days])}
          foot={["Grand Total", String(q.data.length), "", "", "", "", "", "", "", "", "", ""]}
        />
      )}
    </ReportFrame>
  );
}

/** Reservation Manifest (ReportsReservationManifest.aspx): grouped by location / location out / location in / vehicle type / admin. */
export function ReservationManifestReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ pickupFrom: "", pickupTo: "", returnFrom: "", returnTo: "", createdFrom: "", createdTo: "", assignedId: "", makeId: "", vehicleStatus: "", vehicleTypeId: "", locationId: "", groupBy: "location", sortBy: "pickup", enteredBy: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.reservationManifest.queryOptions({
      pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""),
      createdFrom: fromDay(run?.createdFrom ?? ""), createdTo: fromDay(run?.createdTo ?? ""), assignedId: run?.assignedId || undefined, makeId: run?.makeId, vehicleStatus: run?.vehicleStatus,
      vehicleTypeId: run?.vehicleTypeId, locationId: run?.locationId, enteredBy: run?.enteredBy || undefined,
    }),
    enabled: !!run,
    retry: false,
  });
  const people = useQuery(trpc.staff.tasks.people.queryOptions()).data ?? [];
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const sortKey: Record<string, (r: NonNullable<typeof q.data>[number]) => string> = {
    pickup: (r) => new Date(r.pickup).toISOString(), return: (r) => new Date(r.returnDate).toISOString(), locOut: (r) => r.locOut, locIn: (r) => r.locIn, type: (r) => r.vehicleType,
  };
  const groupKey: Record<string, (r: NonNullable<typeof q.data>[number]) => string> = {
    location: (r) => r.location, locOut: (r) => r.locOut, locIn: (r) => r.locIn, type: (r) => r.vehicleType, admin: (r) => people.find((p) => p.id === r.enteredById)?.name ?? "—",
  };
  const groups = React.useMemo(() => {
    if (!q.data || !run) return [];
    const sorted = [...q.data].sort((a, b) => sortKey[run.sortBy]!(a).localeCompare(sortKey[run.sortBy]!(b)));
    const m = new Map<string, typeof sorted>();
    for (const r of sorted) m.set(groupKey[run.groupBy]!(r), [...(m.get(groupKey[run.groupBy]!(r)) ?? []), r]);
    return [...m.entries()];
  }, [q.data, run, people]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ReportFrame
      title="Reservations Manifest"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="rm-pf" label="Pickup Date - Start" value={v.pickupFrom} onChange={set("pickupFrom")} />
          <DateField id="rm-pt" label="To" value={v.pickupTo} onChange={set("pickupTo")} />
          <DateField id="rm-rf" label="Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="rm-rt" label="To" value={v.returnTo} onChange={set("returnTo")} />
          <DateField id="rm-cf" label="Reservation Date - From" value={v.createdFrom} onChange={set("createdFrom")} />
          <DateField id="rm-ct" label="To" value={v.createdTo} onChange={set("createdTo")} />
          <div className="space-y-1"><Label htmlFor="rm-vid">Vehicle ID</Label><Input id="rm-vid" value={v.assignedId} onChange={(e) => set("assignedId")(e.target.value)} /></div>
          <SelectFilter id="rm-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} all="ALL" />
          <SelectFilter id="rm-vs" label="Vehicle Status" value={v.vehicleStatus} onChange={set("vehicleStatus")} options={[{ value: "AUCTION", label: "Auction" }, { value: "AVAILABLE", label: "Available" }, { value: "HOLD_FOR_SALE", label: "Hold for Sale" }, { value: "ON_RENT", label: "On Rent" }]} all="ALL" />
          <SelectFilter id="rm-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
          <SelectFilter id="rm-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
          <SelectFilter id="rm-gb" label="Group By" value={v.groupBy} onChange={set("groupBy")} options={[{ value: "location", label: "Location" }, { value: "locOut", label: "Location Out" }, { value: "locIn", label: "Location In" }, { value: "type", label: "VehicleType" }, { value: "admin", label: "AdminID" }]} all={false} />
          <SelectFilter id="rm-sb" label="Sort By" value={v.sortBy} onChange={set("sortBy")} options={[{ value: "pickup", label: "Pickup Date" }, { value: "return", label: "Return Date" }, { value: "locOut", label: "Pickup Location" }, { value: "locIn", label: "Return Location" }, { value: "type", label: "Vehicle Type" }]} all={false} />
          <div className="space-y-1"><Label htmlFor="rm-eb">Entered By</Label><Input id="rm-eb" value={v.enteredBy} onChange={(e) => set("enteredBy")(e.target.value)} /></div>
        </>
      }
      header={[["Location", locName(f, run?.locationId)], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? ""], ["Pickup Date Start", run?.pickupFrom ?? ""], ["Pickup Date End", run?.pickupTo ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {groups.length === 0 && <ReportTable head={["Reservation#", "Vehicle ID", "Vehicle Type", "Company", "Full Name", "Pickup Date", "Loc.Out", "Return Date", "Loc.In"]} rows={[]} />}
          {groups.map(([g, rows]) => (
            <div key={g}>
              <p className="mb-1 font-bold">{g}</p>
              <ReportTable
                head={["Reservation#", "Vehicle ID", "Vehicle Type", "Company", "Full Name", "Pickup Date", "Loc.Out", "Return Date", "Loc.In"]}
                rows={rows.map((r) => [<Link key="n" className="text-primary hover:underline" href={`/admin/reservations/${r.id}`}>{r.number}</Link>, r.vehicleId, r.vehicleType, r.company, r.fullName, ymdhm(r.pickup), r.locOut, ymdhm(r.returnDate), r.locIn])}
                foot={["Total", String(rows.length), "", "", "", "", "", "", ""]}
              />
            </div>
          ))}
          <p className="font-bold">Total {q.data.length}</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Vehicle Due In (ReportsVehicleDueIn.aspx). */
export function VehicleDueInReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", assignedId: "", returnFrom: "", returnTo: "", returnLocationId: "", currentLocationId: "", vehicleTypeId: "", filterBy: "RENTAL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehicleDueIn.queryOptions({ makeId: run?.makeId, assignedId: run?.assignedId || undefined, returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""), returnLocationId: run?.returnLocationId, currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId, filterBy: (run?.filterBy ?? "RENTAL") as "RENTAL" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame
      title="Vehicle Due In"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <SelectFilter id="di-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
          <div className="space-y-1"><Label htmlFor="di-vid">Vehicle ID</Label><Input id="di-vid" value={v.assignedId} onChange={(e) => set("assignedId")(e.target.value)} /></div>
          <DateField id="di-rf" label="Return Date Start" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="di-rt" label="Return Date End" value={v.returnTo} onChange={set("returnTo")} />
          <SelectFilter id="di-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} />
          <SelectFilter id="di-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
          <SelectFilter id="di-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
          <SelectFilter id="di-fb" label="Filter By" value={v.filterBy} onChange={set("filterBy")} options={[{ value: "RENTAL", label: "Rental" }, { value: "RESERVATION", label: "Reservation" }]} all={false} />
        </>
      }
      header={[["Location", locName(f, run?.returnLocationId)], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? ""], ["Return Start Date", run?.returnFrom ?? ""], ["Return End Date", run?.returnTo ?? ""]]}
    >
      {q.data && (
        <ReportTable
          head={[run?.filterBy === "RESERVATION" ? "Reservation #" : "Rental #", "First Name", "Last Name", "Phone", "Vehicle ID", "Model", "Company", "Pickup Date", "Loc. Out", "Exp. Return Date"]}
          rows={q.data.map((r) => [<Link key="n" className="text-primary hover:underline" href={r.kind === "RENTAL" ? `/admin/rentals/${r.id}` : `/admin/reservations/${r.id}`}>{r.number}</Link>, r.firstName, r.lastName, r.phone, r.vehicleId, r.model, r.company, ymdhm(r.pickup), r.locOut, ymdhm(r.expectedReturn)])}
          foot={["Total", String(q.data.length), "", "", "", "", "", "", "", ""]}
        />
      )}
    </ReportFrame>
  );
}
