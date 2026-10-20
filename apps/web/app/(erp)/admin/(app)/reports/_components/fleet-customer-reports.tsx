"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

const STATUS = [{ value: "AUCTION", label: "Auction" }, { value: "AVAILABLE", label: "Available" }, { value: "HOLD_FOR_SALE", label: "Hold for Sale" }, { value: "ON_RENT", label: "On Rent" }];
const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const years = () => Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() + 3 - i)).map((y) => ({ value: y, label: y }));
const veh = (id: string, label: string) => <Link key="v" className="text-primary hover:underline" href={`/admin/vehicles/${id}`}>{label}</Link>;

/** Vehicles Summary (ReportsVehicleList.aspx). */
export function VehiclesSummaryReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", assignedId: "", year: "", status: "", owningLocationId: "", vehicleTypeId: "", groupBy: "LOCATION" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.vehiclesSummary.queryOptions({ makeId: run?.makeId, assignedId: run?.assignedId || undefined, year: run?.year ? Number(run.year) : undefined, status: run?.status, owningLocationId: run?.owningLocationId, vehicleTypeId: run?.vehicleTypeId, groupBy: (run?.groupBy ?? "LOCATION") as "LOCATION" }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Vehicle", "Current Location", "Type", "Year", "Odometer", "Fuel", "Tank Size", "Make", "Model", "VIN", "Plate"];
  return (
    <ReportFrame title="Vehicle Summary" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vs-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        {text("vs-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="vs-yr" label="Year" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="vs-st" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="" />
        <SelectFilter id="vs-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="vs-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="vs-gb" label="Group By" value={v.groupBy} onChange={set("groupBy")} all={false} options={[{ value: "NONE", label: "None" }, { value: "LOCATION", label: "Location" }, { value: "MAKE", label: "Make" }, { value: "MODEL", label: "Model" }, { value: "YEAR", label: "Year" }, { value: "STATUS", label: "Status" }, { value: "TYPE", label: "VehicleType" }]} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.owningLocationId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.map((g) => (
            <div key={g.name}>
              {g.name && <p className="mb-1 font-bold">{g.name}</p>}
              <ReportTable head={head} right={[3, 4, 6]} rows={g.rows.map((r) => [veh(r.id, r.vehicleId), r.currentLocation, r.type, r.year ?? "", r.odometer ?? "", `${r.fuel}/16`, r.tankSize, r.make, r.model, r.vin, r.plate])} foot={["Total", String(g.rows.length), "", "", "", "", "", "", "", "", ""]} />
            </div>
          ))}
          <p className="font-bold">Grand Total {q.data.count}</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Vehicle License Expiration (ReportsVehicleLicenseExpiration.aspx). */
export function LicenseExpirationReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", assignedId: "", from: "", to: "", year: "", owningLocationId: "", vehicleTypeId: "", licenseProvince: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.licenseExpiration.queryOptions({ makeId: run?.makeId, assignedId: run?.assignedId || undefined, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), year: run?.year ? Number(run.year) : undefined, owningLocationId: run?.owningLocationId, vehicleTypeId: run?.vehicleTypeId, licenseProvince: run?.licenseProvince || undefined }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Vehicle License Expiration" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="le-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        {text("le-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <DateField id="le-f" label="Expiration Start Date" value={v.from} onChange={set("from")} />
        <DateField id="le-t" label="Expiration End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="le-yr" label="Year" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="le-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="le-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        {text("le-st", "License State", v.licenseProvince, set("licenseProvince"))}
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.owningLocationId)?.name ?? "All"], ["Exp. Start Date", run?.from ?? ""], ["Exp. End Date", run?.to ?? ""], ["State", run?.licenseProvince ?? ""]]}
    >
      {q.data && <ReportTable head={["Vehicle ID", "Make", "Model", "Type", "Plate", "State", "Expiration Date"]} rows={q.data.map((r) => [veh(r.id, r.vehicleId), r.make, r.model, r.type, r.plate, r.state, ymd(r.expires)])} foot={["Total", String(q.data.length), "", "", "", "", ""]} />}
    </ReportFrame>
  );
}

/** Maintenance Alert (ReportsVehicleMaintanaceAlert.aspx). */
export function MaintenanceAlertReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ assignedId: "", makeId: "", year: "", owningLocationId: "", vehicleTypeId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.maintenanceAlert.queryOptions({ assignedId: run?.assignedId || undefined, makeId: run?.makeId, year: run?.year ? Number(run.year) : undefined, owningLocationId: run?.owningLocationId, vehicleTypeId: run?.vehicleTypeId, status: run?.status }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Maintenance Alert" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        {text("ma-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="ma-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <SelectFilter id="ma-yr" label="Year" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="ma-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="ma-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="ma-st" label="Current Status" value={v.status} onChange={set("status")} options={STATUS} all="Please select" />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.owningLocationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? ""]]}
    >
      {q.data && <ReportTable head={["Vehicle ID", "Plate", "Current Location", "Status", "Model", "Type", "Odometer", "Last Serv.", "Interval", "Next Serv. Date", "KM To Next Service"]} right={[6, 8, 10]}
        rows={q.data.map((r) => [veh(r.id, r.vehicleId), r.plate, r.currentLocation, statusLabel(r.status), r.model, r.type, r.odometer ?? "", ymd(r.lastService), r.interval || "", ymd(r.nextServiceDate), r.kmToNext == null ? "" : <span key="k" className={r.kmToNext <= 0 ? "font-bold text-destructive" : r.kmToNext <= 500 ? "font-semibold text-amber-700" : ""}>{r.kmToNext.toLocaleString()}</span>])} />}
    </ReportFrame>
  );
}

/** Customer List (ReportsCustomerList.aspx) and Undesired Customers (ReportsCustomersUndesired.aspx). */
export function CustomerListReport({ undesired = false }: { undesired?: boolean }) {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ firstName: "", lastName: "", city: "", address: "", phone: "", postal: "", locationId: "", active: "ALL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.customerList.queryOptions({ firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, city: run?.city || undefined, address: run?.address || undefined, phone: run?.phone || undefined, postal: run?.postal || undefined, locationId: run?.locationId, active: (run?.active ?? "ALL") as "ALL", undesiredOnly: undesired }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const cust = (r: { id: string; customerId: number | null }) => <Link key="c" className="text-primary hover:underline" href={`/admin/customers/${r.id}`}>{r.customerId ?? "view"}</Link>;
  return (
    <ReportFrame title={undesired ? "Undesired Customers" : "Customer List"} generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        {text("cl-fn", "First Name", v.firstName, set("firstName"))}
        {text("cl-ln", "Last Name", v.lastName, set("lastName"))}
        {text("cl-ci", "City", v.city, set("city"))}
        {text("cl-ad", "Address", v.address, set("address"))}
        {text("cl-ph", "Phone", v.phone, set("phone"))}
        {!undesired && text("cl-zp", "Zip/Postal Code", v.postal, set("postal"))}
        <SelectFilter id="cl-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        {!undesired && <SelectFilter id="cl-ac" label="Active" value={v.active} onChange={set("active")} all={false} options={[{ value: "ALL", label: "All" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />}
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (undesired
        ? <ReportTable head={["Customer ID", "First Name", "Last Name", "Location Name", "Address", "Phone", "Company Name"]} rows={q.data.map((r) => [cust(r), r.firstName, r.lastName, r.location, [r.address1, r.city].filter(Boolean).join(", "), r.phone ?? "", r.company])} foot={["Grand Total", String(q.data.length), "", "", "", "", ""]} />
        : <ReportTable head={["Customer ID", "First Name", "Last Name", "Active", "Address", "City", "Phone", "Driver Lic.#", "Country Code", "Email", "Email Marketing Unsubscription", "Date Entered", "Zip"]}
            rows={q.data.map((r) => [cust(r), r.firstName, r.lastName, r.isActive ? "Yes" : "No", r.address1 ?? "", r.city ?? "", r.phone ?? "", r.licenseNumber ?? "", r.country ?? "", r.email ?? "", r.unsubscribedFromMarketing ? "Yes" : "", ymd(r.createdAt), r.postal ?? ""])}
            foot={["Grand Total", String(q.data.length), "", "", "", "", "", "", "", "", "", "", ""]} />)}
    </ReportFrame>
  );
}
export const UndesiredCustomersReport = () => <CustomerListReport undesired />;

/** Traffic Tickets (ReportsTrafficTickets.aspx). */
export function TrafficTicketsReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", firstName: "", lastName: "", city: "", amount: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.trafficTickets.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, city: run?.city || undefined, amount: run?.amount ? Number(run.amount) : undefined, locationId: run?.locationId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Traffic Tickets" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="tt-f" label="Traffic Tickets From" value={v.from} onChange={set("from")} />
        <DateField id="tt-t" label="Traffic Tickets To" value={v.to} onChange={set("to")} />
        {text("tt-fn", "First Name", v.firstName, set("firstName"))}
        {text("tt-ln", "Last Name", v.lastName, set("lastName"))}
        {text("tt-ci", "City", v.city, set("city"))}
        {text("tt-am", "Amount", v.amount, set("amount"))}
        <SelectFilter id="tt-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && <ReportTable head={["Rental #", "First Name", "Last Name", "Date", "Description", "Amount", "Location", "Is Paid"]} right={[5]}
        rows={q.data.map((r) => [<Link key="ra" className="text-primary hover:underline" href={`/admin/rentals/${r.rentalId}`}>{r.raNumber}</Link>, r.firstName, r.lastName, ymdhm(r.date), r.description, money(r.amount), r.location, r.isPaid ? "Yes" : "No"])}
        foot={["Total", String(q.data.length), "", "", "", money(q.data.reduce((a, r) => a + r.amount, 0)), "", ""]} />}
    </ReportFrame>
  );
}
