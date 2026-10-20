"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@mrac/api";
import { useTRPC } from "@mrac/api/client";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd } from "./report-kit";

type Revenue = RouterOutputs["staff"]["reports"]["dailyBusiness"];
const METHOD: Record<string, string> = { AMEX: "Amex", CASH: "Cash", DEBIT: "Debit", EMT: "EMT", INTERNAL: "Internal", MASTERCARD: "Mastercard", VISA: "Visa" };

/** Rows + revenue summary + payment summary — the body shared by Daily Business Report and Month to Date. */
function RevenueBody({ r, withRows }: { r: Revenue; withRows: boolean }) {
  const s = r.summary;
  const block = (title: string, g: { items: { name: string; amount: number }[]; total: number }) => (
    <div className="mb-3">
      <p className="font-bold">{title}</p>
      {g.items.map((x) => <div key={x.name} className="grid max-w-md grid-cols-[1fr_7rem]"><span>{x.name}</span><span className="text-right tabular-nums">{money(x.amount)}</span></div>)}
      <div className="grid max-w-md grid-cols-[1fr_7rem] font-semibold"><span>Grand Total</span><span className="text-right tabular-nums">{money(g.total)}</span></div>
    </div>
  );
  const line = (label: string, n: number, bold?: boolean) => <div className={`grid max-w-md grid-cols-[1fr_7rem] ${bold ? "font-bold" : ""}`}><span>{label}</span><span className="text-right tabular-nums">{money(n)}</span></div>;
  return (
    <div className="space-y-5">
      {withRows && (
        <ReportTable
          head={["RA#", "Full Name", "Vehicle", "Pickup Date-In", "Days", "Time", "Discount", "Mileage", "Fuel", "Upgrade", "One Way", "Damage", "Company", "Taxes", "Ins", "Misc", "Adjust", "I", "II", "III", "IV", "Total", "Paid", "Balance"]}
          right={[4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]}
          rows={r.rows.map((x) => [
            <Link key="ra" className="text-primary hover:underline" href={`/admin/rentals/${x.id}`}>{x.raNumber}</Link>, x.fullName, x.vehicle, `${ymd(x.pickup)} – ${ymd(x.dateIn)}`, x.days,
            money(x.time), money(x.discount), money(x.mileage), money(x.fuel), money(x.upgrade), money(x.oneWay), money(x.damage), x.company,
            money(x.taxes), money(x.ins), money(x.misc), money(x.adjust), ...x.other.map(money), money(x.total), money(x.paid), money(x.balance),
          ])}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="font-bold">Rental Revenue</p>
          {line("Time Charged", s.timeCharged)}
          {line("KM Charged", s.kmCharged)}
          {line("Net Time And KM", s.netTimeAndKm, true)}
          <div className="h-3" />
          {block("Total Miscellaneous Charges", s.misc)}
          {block("Total Insurances", s.insurances)}
          {block("Total Taxes", s.taxes)}
          {line("Total Fuel Charge", s.fuel)}
          {line("Total Upgrade", s.upgrade)}
          {line("Total One Way Fee", s.oneWay)}
          {line("Total Damages", s.damages)}
          {line("Total Traffic Tickets", s.trafficTickets)}
          {line("Total Other Charges I", s.other[0]!)}
          {line("Total Other Charges II", s.other[1]!)}
          {line("Total Other Charges III", s.other[2]!)}
          {line("Total Other Charges IIII", s.other[3]!)}
          {line("Total Discounts", s.discounts)}
          {line("Grand Total", s.grandTotal, true)}
          {line("Adjustment Total", s.adjustments)}
        </div>
        <div>
          <p className="font-bold">Payment Summary</p>
          <div className="grid max-w-md grid-cols-[1fr_7rem]"><span>Total Rental Count</span><span className="text-right">{r.payments.rentalCount}</span></div>
          <div className="grid max-w-md grid-cols-[1fr_7rem]"><span>Total Days</span><span className="text-right">{r.payments.totalDays}</span></div>
          {line("Rentals Grand Total", r.payments.rentalsGrandTotal)}
          {line("Accounts Receivable", r.payments.accountsReceivable)}
          <div className="mt-3 grid max-w-md grid-cols-[1fr_7rem] font-bold underline"><span>Payment Method</span><span className="text-right">Paid</span></div>
          {r.payments.paidBy.map((p) => line(METHOD[p.method] ?? p.method, p.paid))}
          {line("Total", r.payments.totalPaid, true)}
        </div>
      </div>
    </div>
  );
}

/** Daily Business Report (ReportsDBR.aspx). */
export function DailyBusinessReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ closeDate: "", closeFrom: "", closeTo: "", returnFrom: "", returnTo: "", owningLocationId: "", pickupLocationId: "", returnLocationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.dailyBusiness.queryOptions({
      closeDate: fromDay(run?.closeDate ?? ""), closeFrom: fromDay(run?.closeFrom ?? ""), closeTo: fromDay(run?.closeTo ?? ""), returnFrom: fromDay(run?.returnFrom ?? ""), returnTo: fromDay(run?.returnTo ?? ""),
      owningLocationId: run?.owningLocationId, pickupLocationId: run?.pickupLocationId, returnLocationId: run?.returnLocationId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const loc = (id: string) => f.locations.find((l) => l.id === id)?.name ?? (id ? "" : "All");
  return (
    <ReportFrame
      title="Daily Business Report"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <DateField id="db-cd" label="Rental Close Date (One Day)" value={v.closeDate} onChange={set("closeDate")} />
          <DateField id="db-cf" label="Rental Close Date - From" value={v.closeFrom} onChange={set("closeFrom")} />
          <DateField id="db-ct" label="To (max 31 days)" value={v.closeTo} onChange={set("closeTo")} />
          <div />
          <DateField id="db-rf" label="Return Date - From" value={v.returnFrom} onChange={set("returnFrom")} />
          <DateField id="db-rt" label="To" value={v.returnTo} onChange={set("returnTo")} />
          <SelectFilter id="db-ol" label="Owning Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
          <SelectFilter id="db-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} />
          <SelectFilter id="db-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} />
        </>
      }
      header={[
        ["Location", loc(run?.owningLocationId ?? "")],
        ["Pickup Location", run?.pickupLocationId ? loc(run.pickupLocationId) : ""],
        ["Rental Close Date Start", run?.closeDate || run?.closeFrom || ""],
        ["Rental Close Date End", run?.closeDate || run?.closeTo || ""],
        ["Rental Return Date Start", run?.returnFrom ?? ""],
        ["Rental Return Date End", run?.returnTo ?? ""],
      ]}
    >
      {q.data && <RevenueBody r={q.data} withRows />}
    </ReportFrame>
  );
}

/** Month to Date (ReportsMonthToDate.aspx): by rental return month or close month. */
export function MonthToDateReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const months = React.useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const d = new Date();
    for (let i = 0; i < 40; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ value: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: x.toLocaleDateString("en-CA", { month: "long", year: "numeric" }) });
    }
    return out;
  }, []);
  const [v, setV] = React.useState({ returnMonth: "", closeMonth: months[0]!.value, owningLocationId: "", pickupLocationId: "", returnLocationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.monthToDate.queryOptions({
      month: run?.returnMonth || run?.closeMonth || "",
      by: run?.returnMonth ? "RETURN" : "CLOSE",
      owningLocationId: run?.owningLocationId, pickupLocationId: run?.pickupLocationId, returnLocationId: run?.returnLocationId,
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const label = months.find((m) => m.value === (run?.returnMonth || run?.closeMonth))?.label ?? "";
  return (
    <ReportFrame
      title="Month To Date"
      generated={!!run}
      onGenerate={() => setRun({ ...v })}
      loading={q.isLoading}
      error={q.error?.message}
      filters={
        <>
          <SelectFilter id="m-rm" label="By Rental Return Date Month" value={v.returnMonth} onChange={(x) => setV({ ...v, returnMonth: x, closeMonth: x ? "" : v.closeMonth })} options={months} all="Please select" />
          <SelectFilter id="m-cm" label="By Rental Close Date Month" value={v.closeMonth} onChange={(x) => setV({ ...v, closeMonth: x, returnMonth: x ? "" : v.returnMonth })} options={months} all="Please select" />
          <SelectFilter id="m-ol" label="Location" value={v.owningLocationId} onChange={set("owningLocationId")} options={f.locations} />
          <SelectFilter id="m-pl" label="Pickup Location" value={v.pickupLocationId} onChange={set("pickupLocationId")} options={f.locations} />
          <SelectFilter id="m-rl" label="Return Location" value={v.returnLocationId} onChange={set("returnLocationId")} options={f.locations} />
        </>
      }
      header={[["Location", f.locations.find((l) => l.id === run?.owningLocationId)?.name ?? "All"], ["Month to Date Revenue for", label]]}
    >
      {q.data && <RevenueBody r={q.data} withRows={false} />}
    </ReportFrame>
  );
}
