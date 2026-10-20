"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { usePaymentMethods } from "../../../../_components/payment-methods";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const years = () => Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() + 3 - i)).map((y) => ({ value: y, label: y }));
const veh = (id: string, label: string) => <Link key="v" className="text-primary hover:underline" href={`/admin/vehicles/${id}`}>{label}</Link>;
const rental = (id: string | null, n: number | null) => (id && n != null ? <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link> : "");
const resv = (id: string | null, n: number | null) => (id && n != null ? <Link key="s" className="text-primary hover:underline" href={`/admin/reservations/${id}`}>{n}</Link> : "");

/** Group rows by a key, in order of first appearance. */
function groupBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()];
}

/** Vehicle Maintenance (ReportsVehicleMaintanace.aspx): grouped by vehicle. */
export function VehicleMaintenanceReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", makeId: "", assignedId: "", year: "", locationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.vehicleMaintenance.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), makeId: run?.makeId, assignedId: run?.assignedId || undefined, year: run?.year ? Number(run.year) : undefined, locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Date", "Type", "Make", "Model", "Odometer", "Shop", "PO#", "Payment Type", "Payment Amount", "Parts", "Labour"];
  return (
    <ReportFrame title="Vehicle Maintenance" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="vm-f" label="Maintenance Start Date" value={v.from} onChange={set("from")} />
        <DateField id="vm-t" label="Maintenance End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="vm-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        {text("vm-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="vm-yr" label="Year" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="vm-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vm-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Maintenance Start Date", run?.from ?? ""], ["Maintenance End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.length === 0 && <ReportTable head={head} rows={[]} />}
          {groupBy(q.data, (r) => r.vehicleRowId).map(([id, rows]) => (
            <div key={id}>
              <p className="mb-1 font-bold">{veh(id, rows[0]!.vehicleId)}</p>
              <ReportTable head={head} right={[4, 8, 9, 10]} rows={rows.map((r) => [ymd(r.date), r.type, r.make, r.model, r.odometer ?? "", r.shop, r.po, r.paymentType, money(r.paymentAmount), money(r.parts), money(r.labour)])} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.reduce((a, r) => a + r.paymentAmount, 0))} · {q.data.length} entries</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Vehicle Repairs (ReportsVehicleRepairs.aspx): grouped by vehicle. */
export function VehicleRepairsReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", makeId: "", assignedId: "", owningLocationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.vehicleRepairs.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), makeId: run?.makeId, assignedId: run?.assignedId || undefined, owningLocationId: run?.owningLocationId, vehicleTypeId: run?.vehicleTypeId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Make", "Model", "Date", "Shop", "Part", "Labour", "KM Out", "KM In"];
  return (
    <ReportFrame title="Vehicle Repairs" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vr-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <DateField id="vr-f" label="Repair Date - From" value={v.from} onChange={set("from")} />
        <DateField id="vr-t" label="Repair Date - To" value={v.to} onChange={set("to")} />
        {text("vr-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="vr-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="vr-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.owningLocationId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.length === 0 && <ReportTable head={head} rows={[]} />}
          {groupBy(q.data, (r) => r.vehicleRowId).map(([id, rows]) => (
            <div key={id}>
              <p className="mb-1 font-bold">{veh(id, rows[0]!.vehicleId)}</p>
              <ReportTable head={head} right={[4, 5, 6, 7]} rows={rows.map((r) => [r.make, r.model, ymd(r.date), r.shop, money(r.part), money(r.labour), r.kmOut ?? "", r.kmIn ?? ""])} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.reduce((a, r) => a + r.part + r.labour, 0))} · {q.data.length} repairs</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Source Of Referral — "Revenue By Referrals" (ReportsReferral.aspx). */
export function SourceOfReferralReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ referralId: "", from: "", to: "", owningLocationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.sourceOfReferral.queryOptions({ referralId: run?.referralId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), owningLocationId: run?.owningLocationId, vehicleTypeId: run?.vehicleTypeId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Rental #", "Res#", "First Name", "Last Name", "Vehicle ID", "Model", "Pickup Date", "Return Date", "Expected Return Date", "Time", "Mileage", "Total", "Comission"];
  return (
    <ReportFrame title="Revenue By Referrals" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="sr-r" label="Referral" value={v.referralId} onChange={set("referralId")} options={f.referrals} all="Please Select" />
        <DateField id="sr-f" label="Date Start" value={v.from} onChange={set("from")} />
        <DateField id="sr-t" label="Date End" value={v.to} onChange={set("to")} />
        <SelectFilter id="sr-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="sr-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} all="ALL" />
      </>}
      header={[["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "ALL"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.name}>
              <p className="mb-1 font-bold">{g.name}</p>
              <ReportTable head={head} right={[9, 10, 11, 12]}
                rows={g.rows.map((r) => { const x = r as typeof r & { reservationNumber: number | null; expectedReturn: string | Date }; return [rental(r.id, r.raNumber), x.reservationNumber ?? "", r.firstName, r.lastName, r.vehicleId, r.model, ymd(r.pickup), ymd(r.returnDate), ymd(x.expectedReturn), money(r.time), money(r.mileage), money(r.total), money(r.commission)]; })}
                foot={head.map((_, i) => (i === 0 ? `Total (${g.rows.length})` : i === 11 ? money(g.total) : ""))} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.total)} · {q.data.count} rentals</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Customer By Region (ReportsCustomerByRegion.aspx). */
export function CustomerByRegionReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ firstName: "", lastName: "", city: "", phone: "", regionId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.customerByRegion.queryOptions({ firstName: run?.firstName || undefined, lastName: run?.lastName || undefined, city: run?.city || undefined, phone: run?.phone || undefined, regionId: run?.regionId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Customer ID", "First Name", "Last Name", "Address", "City", "Phone"];
  return (
    <ReportFrame title="Customer By Region" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        {text("cr-fn", "First Name", v.firstName, set("firstName"))}
        {text("cr-ln", "Last Name", v.lastName, set("lastName"))}
        {text("cr-ci", "City", v.city, set("city"))}
        {text("cr-ph", "Phone", v.phone, set("phone"))}
        <SelectFilter id="cr-rg" label="Region" value={v.regionId} onChange={set("regionId")} options={f.regions} />
      </>}
      header={[["Region", f.regions.find((r) => r.id === run?.regionId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.name}>
              <p className="mb-1 font-bold">{g.name}</p>
              <ReportTable head={head} rows={g.rows.map((c) => [<Link key="c" className="text-primary hover:underline" href={`/admin/customers/${c.id}`}>{c.legacyId ?? "view"}</Link>, c.firstName, c.lastName, c.address1 ?? "", c.city ?? "", c.phone ?? ""])} foot={["Total", String(g.rows.length), "", "", "", ""]} />
            </div>
          ))}
          <p className="font-bold">Grand Total {q.data.count}</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Payments & Charges (ReportsTransactions.aspx): grouped by payment method. */
export function PaymentsAndChargesReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const pm = usePaymentMethods(null);
  const [v, setV] = React.useState({ from: "", to: "", method: "", type: "PAYMENT", firstName: "", lastName: "", authorizationCode: "", transactionCode: "", amount: "", raNumber: "", reservationNumber: "", takenBy: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.paymentsAndCharges.queryOptions({
      from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), method: run?.method || undefined, type: (run?.type ?? "PAYMENT") as "PAYMENT", firstName: run?.firstName || undefined, lastName: run?.lastName || undefined,
      authorizationCode: run?.authorizationCode || undefined, transactionCode: run?.transactionCode || undefined, amount: run?.amount ? Number(run.amount) : undefined,
      raNumber: run?.raNumber ? Number(run.raNumber) : undefined, reservationNumber: run?.reservationNumber ? Number(run.reservationNumber) : undefined, takenBy: run?.takenBy || undefined, locationId: run?.locationId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Date", "Payment Details", "Rental #", "Reservation #", "Customer Full Name", "Taken By", "Card No", "Authorization Code", "Transaction Code", "Amount"];
  return (
    <ReportFrame title="Payments and Charges" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="pc-f" label="Transaction Date From" value={v.from} onChange={set("from")} />
        <DateField id="pc-t" label="to" value={v.to} onChange={set("to")} />
        <SelectFilter id="pc-m" label="Payment Method" value={v.method} onChange={set("method")} options={pm.options} />
        <SelectFilter id="pc-ty" label="Transaction Type" value={v.type} onChange={set("type")} all={false} options={[{ value: "PAYMENT", label: "Payment" }, { value: "AUTHORIZATION", label: "Auth" }, { value: "REFUND", label: "Refund" }, { value: "ALL", label: "ALL" }]} />
        {text("pc-fn", "First Name", v.firstName, set("firstName"))}
        {text("pc-ln", "Last Name", v.lastName, set("lastName"))}
        {text("pc-ac", "Authorization Code", v.authorizationCode, set("authorizationCode"))}
        {text("pc-tc", "Transaction Code", v.transactionCode, set("transactionCode"))}
        {text("pc-am", "Amount", v.amount, set("amount"))}
        {text("pc-ra", "Rental Agreement#", v.raNumber, set("raNumber"))}
        {text("pc-rs", "Reservation #", v.reservationNumber, set("reservationNumber"))}
        {text("pc-tb", "Taken By", v.takenBy, set("takenBy"))}
        <SelectFilter id="pc-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.name}>
              <p className="mb-1 font-bold">{g.name}</p>
              <ReportTable head={head} right={[9]} rows={g.rows.map((r) => [ymdhm(r.date), r.details, rental(r.rentalId, r.raNumber), resv(r.reservationId, r.reservationNumber), r.customer, r.takenBy, r.cardNo, r.authorizationCode, r.transactionCode, money(r.amount)])} foot={head.map((_, i) => (i === 0 ? `Total (${g.rows.length})` : i === 9 ? money(g.total) : ""))} />
            </div>
          ))}
          <p className="font-bold">Grand Total {money(q.data.total)} · {q.data.count} transactions</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Reservations No Showup/Cancelled (ReportsReservationsNoShowCancelled.aspx). */
export function NoShowCancelledReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ pickupFrom: "", pickupTo: "", returnFrom: "", returnTo: "", createdFrom: "", createdTo: "", makeId: "", vehicleTypeId: "", locationId: "", pickupLocationId: "", returnLocationId: "", status: "ALL" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.noShowCancelled.queryOptions({
      pickupFrom: fromDay(run?.pickupFrom ?? ""), pickupTo: fromDay(run?.pickupTo ?? ""), returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""), createdFrom: fromDay(run?.createdFrom ?? ""), createdTo: fromDay(run?.createdTo ?? ""),
      makeId: run?.makeId, vehicleTypeId: run?.vehicleTypeId, locationId: run?.locationId, pickupLocationId: run?.pickupLocationId, returnLocationId: run?.returnLocationId, status: (run?.status ?? "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Reservation NoShow Cancel" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="ns-pf" label="Pickup Date - From" value={v.pickupFrom} onChange={set("pickupFrom")} />
        <DateField id="ns-pt" label="To" value={v.pickupTo} onChange={set("pickupTo")} />
        <DateField id="ns-rf" label="Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
        <DateField id="ns-rt" label="To" value={v.returnTo} onChange={set("returnTo")} />
        <DateField id="ns-cf" label="Reservation Date - From" value={v.createdFrom} onChange={set("createdFrom")} />
        <DateField id="ns-ct" label="To" value={v.createdTo} onChange={set("createdTo")} />
        <SelectFilter id="ns-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} all="ALL" />
        <SelectFilter id="ns-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="ns-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="ns-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} all="ALL" />
        <SelectFilter id="ns-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} all="ALL" />
        <SelectFilter id="ns-st" label="Status" value={v.status} onChange={set("status")} all={false} options={[{ value: "ALL", label: "No Show and Cancelled" }, { value: "NO_SHOW", label: "No Show" }, { value: "CANCELLED", label: "Cancelled" }]} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Pickup Date Start", run?.pickupFrom ?? ""], ["Pickup Date End", run?.pickupTo ?? ""]]}
    >
      {q.data && (
        <ReportTable
          head={["Res #", "Customer Name", "Reservation Date", "Vehicle Type", "Checkout Date", "Checkout Location", "Check In Date", "Net Rate", "Insurances", "Taxes", "Misc Charges", "One Way Fee", "Total Amount", "Paid", "Cancelled By", "Cancellation Reason"]}
          right={[7, 8, 9, 10, 11, 12, 13]}
          rows={q.data.map((r) => [resv(r.id, r.number), r.customer, ymd(r.reservationDate), r.vehicleType, ymdhm(r.checkout), r.checkoutLocation, ymdhm(r.checkIn), money(r.netRate), money(r.insurances), money(r.taxes), money(r.misc), money(r.oneWay), money(r.total), money(r.paid), r.cancelledBy, r.reason])}
          foot={["Total", String(q.data.length), "", "", "", "", "", "", "", "", "", "", money(q.data.reduce((a, r) => a + r.total, 0)), money(q.data.reduce((a, r) => a + r.paid, 0)), "", ""]}
        />
      )}
    </ReportFrame>
  );
}
