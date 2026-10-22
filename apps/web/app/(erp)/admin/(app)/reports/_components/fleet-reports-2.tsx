"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd, ymdhm } from "./report-kit";

/** Vehicle Insurance, Vehicle Lease/Loan, KM Difference/Missing, Vehicle Utilization (Today), Vehicle Profit/Loss. */

const text = (id: string, label: string, value: string, onChange: (v: string) => void) => (
  <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);
const veh = (id: string, label: string) => <Link key="v" className="text-primary hover:underline" href={`/admin/vehicles/${id}`}>{label}</Link>;
const rental = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link>;
const years = () => Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() + 3 - i)).map((y) => ({ value: y, label: y }));
const ACTIONS = [{ value: "NO_INSURANCE", label: "No Insur." }, { value: "FULL_COVERAGE", label: "Full Cov." }, { value: "LIABILITY_ONLY", label: "Liab. Only" }, { value: "COMPREHENSIVE_ONLY", label: "Comp. Only" }];
const STATUS: Record<string, string> = {
  ACCIDENT_REPLACEMENT: "Accident Replacement", AUCTION: "Auction", AVAILABLE: "Available", COMPREHENSIVE: "Comprehensive", FOR_SALE: "For Sale", GROUNDED: "Grounded", HAS_PROBLEM: "Has Problem",
  HOLD_FOR_SALE: "Hold for Sale", IN_CHECKOUT_PROCESS: "In Checkout Process", IN_REPAIR: "In Repair", IN_SERVICE: "In Service", LEASED_REPLACEMENT: "Leased Replacement", ON_RENT: "On Rent",
  OUT_OF_SERVICE: "Out of Service", SOLD: "Sold", STAFF: "Staff", STOLEN: "Stolen",
};

/** Vehicle Insurance (ReportsLocationInsurance.aspx). */
export function VehicleInsuranceReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", from: "", to: "", locationId: "", currentLocationId: "", vehicleTypeId: "", actionType: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehicleInsurance.queryOptions({ makeId: run?.makeId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId, actionType: (run?.actionType ?? "") as "" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const c = (r: { count: Record<string, number> }, k: string) => r.count[k] ?? 0;
  const a = (r: { amount: Record<string, number> }, k: string) => money(r.amount[k] ?? 0);
  return (
    <ReportFrame title="Vehicle Insurances" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vi-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <DateField id="vi-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="vi-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="vi-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vi-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="vi-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
        <SelectFilter id="vi-at" label="Action Type" value={v.actionType} onChange={set("actionType")} options={ACTIONS} all="Please select" />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"]]}
    >
      {q.data && (
        <ReportTable
          head={["Vehicle ID", "Insurance Expiry", "No Insurances", "Full Coverage Amount", "Liability Only Amount", "Comprehensive Only", "No Ins Amount", "Full Cov Amount", "Lia Only Amount", "Comp Only Amount", "Action Type"]}
          right={[2, 3, 4, 5, 6, 7, 8, 9]}
          rows={q.data.map((r) => [veh(r.vehicleId, r.assignedId), ymd(r.expiry), c(r, "NO_INSURANCE"), c(r, "FULL_COVERAGE"), c(r, "LIABILITY_ONLY"), c(r, "COMPREHENSIVE_ONLY"), a(r, "NO_INSURANCE"), a(r, "FULL_COVERAGE"), a(r, "LIABILITY_ONLY"), a(r, "COMPREHENSIVE_ONLY"), ACTIONS.find((x) => x.value === r.action)?.label ?? ""])}
        />
      )}
    </ReportFrame>
  );
}

/** Vehicle Lease/Loan (ReportsVehicleLeaseLoan.aspx). */
export function VehicleLeaseLoanReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ companyId: "", makeId: "", year: "", locationId: "", currentLocationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehicleLeaseLoan.queryOptions({ companyId: run?.companyId, makeId: run?.makeId, year: run?.year ? Number(run.year) : undefined, locationId: run?.locationId, currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Vehicle Lease/Loan" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vl-co" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <SelectFilter id="vl-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <SelectFilter id="vl-yr" label="Year Made" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="vl-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vl-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="vl-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"]]}
    >
      {q.data && (
        <ReportTable
          head={["Vehicle ID", "Vehicle", "Selling Company", "Bank", "Loan Number", "Acquisition Date", "Finance Amount", "Monthly Payment", "Interest Rate", "Lease Term", "Remaining Payments", "Payoff Amount", "Balance Owed"]}
          right={[6, 7, 8, 10, 11, 12]}
          rows={q.data.map((r) => [veh(r.vehicleId, r.assignedId), r.vehicle, r.company, r.bank, r.loanNumber, ymd(r.acquisitionDate), money(r.financeAmount), money(r.monthlyPayment), r.interestRate ? `${r.interestRate}%` : "", r.leaseTerm, r.remainingPayments ?? "", money(r.payoffAmount), money(r.balanceOwed)])}
        />
      )}
    </ReportFrame>
  );
}

/** KM Difference/Missing (ReportVehicleMilesDiff.aspx). */
export function KmDifferenceReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", from: "", to: "", assignedId: "", locationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.kmDifference.queryOptions({ makeId: run?.makeId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), assignedId: run?.assignedId || undefined, locationId: run?.locationId, vehicleTypeId: run?.vehicleTypeId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["Rental #", "Pickup Date", "Return Date", "Days", "Days Diff", "Odometer Out", "Odometer In", "Kilometers Diff", "Exchanged"];
  return (
    <ReportFrame title="Mileage Difference/Missing" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="km-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <DateField id="km-f" label="Start Date" value={v.from} onChange={set("from")} />
        <DateField id="km-t" label="End Date" value={v.to} onChange={set("to")} />
        {text("km-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="km-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="km-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["Start Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.map((g) => (
            <div key={g.vehicleId}>
              <p className="mb-1 font-bold">{veh(g.vehicleId, g.assignedId)}</p>
              <ReportTable head={head} right={[3, 4, 5, 6, 7]}
                rows={g.rows.map((r) => [
                  rental(r.id as string, r.raNumber as number), ymdhm(r.pickup as string), ymdhm(r.return as string), r.days as number, (r.daysDiff as number | null) ?? "",
                  (r.odometerOut as number).toLocaleString(), r.odometerIn != null ? (r.odometerIn as number).toLocaleString() : "",
                  r.kmDiff != null ? <span key="k" className={(r.kmDiff as number) !== 0 ? "font-semibold text-destructive" : undefined}>{(r.kmDiff as number).toLocaleString()}</span> : "", r.exchanged ? "Yes" : "",
                ])} />
            </div>
          ))}
        </div>
      )}
    </ReportFrame>
  );
}

/** Vehicle Utilization (Today) (ReportsVehicleStatus.aspx). */
export function VehicleUtilizationReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", year: "", locationId: "", currentLocationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehicleUtilization.queryOptions({ makeId: run?.makeId, year: run?.year ? Number(run.year) : undefined, locationId: run?.locationId, currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  return (
    <ReportFrame title="Vehicle Utilization (Today)" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vu-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <SelectFilter id="vu-yr" label="Year Made" value={v.year} onChange={set("year")} options={years()} all="" />
        <SelectFilter id="vu-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vu-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="vu-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["Location", f.locations.find((l) => l.id === run?.locationId)?.name ?? "All"], ["Vehicle Type", f.types.find((t) => t.id === run?.vehicleTypeId)?.name ?? "All"]]}
    >
      {q.data && (
        <div className="space-y-4">
          <ReportTable
            head={["Vehicle ID", "Plate", "Owning Location", "Current Location", "Status", "Rental#", "Vehicle Type", "Year", "Odometer", "Make", "Model", "VIN"]}
            right={[7, 8]}
            rows={q.data.rows.map((r) => [veh(r.id, r.assignedId), r.plate, r.owning, r.current, STATUS[r.status] ?? r.status, r.rentalId && r.raNumber != null ? rental(r.rentalId, r.raNumber) : "", r.type, r.year ?? "", r.odometer?.toLocaleString() ?? "", r.make, r.model, r.vin])}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            {q.data.summary.map((s) => <span key={s.status}><b>{STATUS[s.status] ?? s.status}:</b> {s.count}</span>)}
            <span><b>Utilization:</b> {q.data.onRentPercent}% on rent</span>
          </div>
        </div>
      )}
    </ReportFrame>
  );
}

/** Vehicle Profit/Loss (ReportVehicleProfit.aspx). */
export function VehicleProfitReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ makeId: "", from: "", to: "", assignedId: "", locationId: "", owningLocationId: "", currentLocationId: "", vehicleTypeId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.vehicleProfit.queryOptions({
      makeId: run?.makeId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), assignedId: run?.assignedId || undefined, locationId: run?.locationId,
      owningLocationId: run?.owningLocationId, currentLocationId: run?.currentLocationId, vehicleTypeId: run?.vehicleTypeId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const sum = (k: "income" | "depreciation" | "expenses" | "profit") => money((q.data ?? []).reduce((a, r) => a + r[k], 0));
  return (
    <ReportFrame title="Vehicle Profit & Loss" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="vp-mk" label="Make" value={v.makeId} onChange={set("makeId")} options={f.makes} />
        <DateField id="vp-f" label="Date Start" value={v.from} onChange={set("from")} />
        <DateField id="vp-t" label="Date End" value={v.to} onChange={set("to")} />
        {text("vp-id", "Vehicle ID", v.assignedId, set("assignedId"))}
        <SelectFilter id="vp-lo" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="vp-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
        <SelectFilter id="vp-cl" label="Current Location" value={v.currentLocationId} onChange={set("currentLocationId")} options={f.locations} />
        <SelectFilter id="vp-vt" label="Vehicle Type" value={v.vehicleTypeId} onChange={set("vehicleTypeId")} options={f.types} />
      </>}
      header={[["From", run?.from ?? ""], ["To", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-2">
          <ReportTable
            head={["Assigned ID", "Year Made", "VINNumber", "Rent Length", "Driven Miles", "Income", "Depreciation", "Expenses", "Price", "Profit"]}
            right={[3, 4, 5, 6, 7, 8, 9]}
            rows={q.data.map((r) => [veh(r.id, r.assignedId), r.year ?? "", r.vin, r.days, r.km.toLocaleString(), money(r.income), money(r.depreciation), money(r.expenses), money(r.price), <span key="p" className={r.profit < 0 ? "text-destructive" : undefined}>{money(r.profit)}</span>])}
            foot={["Total", "", "", "", "", sum("income"), sum("depreciation"), sum("expenses"), "", sum("profit")]}
          />
          <p className="text-xs text-muted-foreground">Depreciation uses each vehicle&apos;s Ownership Information “Mo. Dep. Amt.” × months in the period; expenses are maintenance, repairs and damage costs in the period.</p>
        </div>
      )}
    </ReportFrame>
  );
}
