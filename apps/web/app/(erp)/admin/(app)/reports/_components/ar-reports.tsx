"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { DateField, ReportFrame, ReportTable, SelectFilter, fromDay, money, useReportFilters, ymd } from "./report-kit";

/** Corporate A/R By Bills, Customer A/R Report, Reservation A/R by Bills and Corporate A/R Analysis, as RentCentric's. */

const rental = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/rentals/${id}`}>{n}</Link>;
const reservation = (id: string, n: number) => <Link key="r" className="text-primary hover:underline" href={`/admin/reservations/${id}`}>{n}</Link>;
const STATUS = [{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Close" }];
const BALANCE = [{ value: "OWING", label: "Owing" }, { value: "ZERO", label: "Zero" }];
const AGED = [{ value: "LT30", label: "Less than 30 days" }, { value: "30_60", label: "30 - 60 days" }, { value: "60_90", label: "60 - 90 days" }, { value: "GT90", label: "More than 90 days" }];

/** Corporate A/R By Bills (ReportsAccountsReceivables.aspx). */
export function CorporateArReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ companyId: "", companyTypeId: "", from: "", to: "", locationId: "", locationOutId: "", locationInId: "", balance: "", aged: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.corporateAr.queryOptions({
      companyId: run?.companyId, companyTypeId: run?.companyTypeId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, locationOutId: run?.locationOutId,
      locationInId: run?.locationInId, balance: (run?.balance || "ALL") as "ALL", aged: (run?.aged || "ALL") as "ALL", status: (run?.status || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const head = ["First Name", "Last Name", "Rental#", "Close Date", "Amount Due", "Payments", "Balance", "PO#", "RO#", "Claim"];
  return (
    <ReportFrame title="Corporate A/R By Bills" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="car-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <SelectFilter id="car-ct" label="Company Type" value={v.companyTypeId} onChange={set("companyTypeId")} options={f.companyTypes} />
        <DateField id="car-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="car-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="car-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="car-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="car-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
        <SelectFilter id="car-b" label="Balance" value={v.balance} onChange={set("balance")} options={BALANCE} />
        <SelectFilter id="car-a" label="Aged" value={v.aged} onChange={set("aged")} options={AGED} all="Show All" />
        <SelectFilter id="car-s" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="Select Status" />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && (
        <div className="space-y-4">
          {q.data.groups.length === 0 && <ReportTable head={head} rows={[]} />}
          {q.data.groups.map((g) => (
            <div key={g.company}>
              <p className="mb-1 font-bold">{g.company}</p>
              <ReportTable head={head} right={[4, 5, 6]}
                rows={g.rows.map((r) => [r.firstName as string, r.lastName as string, rental(r.rentalId as string, r.raNumber as number), ymd(r.closeDate as string), money(r.due as number), money(r.paid as number), money(r.balance as number), r.po as string, r.ro as string, r.claim as string])}
                foot={["Total", "", "", "", money(g.due), money(g.paid), money(g.balance), "", "", ""]} />
            </div>
          ))}
          <p className="font-bold">Grand Total: Amount Due {money(q.data.totals.due)} · Payments {money(q.data.totals.paid)} · Balance {money(q.data.totals.balance)}</p>
        </div>
      )}
    </ReportFrame>
  );
}

/** Customer A/R Report (ReportsAccountsReceivable.aspx). */
export function CustomerArReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationId: "", locationOutId: "", locationInId: "", balance: "", companyId: "", status: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.customerAr.queryOptions({
      from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, locationOutId: run?.locationOutId, locationInId: run?.locationInId,
      balance: (run?.balance || "ALL") as "ALL", companyId: run?.companyId, status: (run?.status || "ALL") as "ALL",
    }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Customer A/R Report" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="cua-f" label="Close Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="cua-t" label="Close End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="cua-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="cua-lo" label="Location Out" value={v.locationOutId} onChange={set("locationOutId")} options={f.locations} />
        <SelectFilter id="cua-li" label="Location In" value={v.locationInId} onChange={set("locationInId")} options={f.locations} />
        <SelectFilter id="cua-b" label="Balance" value={v.balance} onChange={set("balance")} options={[...BALANCE, { value: "OVERPAID", label: "Overpaid" }]} />
        <SelectFilter id="cua-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <SelectFilter id="cua-s" label="Status" value={v.status} onChange={set("status")} options={STATUS} all="Select Status" />
      </>}
      header={[["Close Begin Date", run?.from ?? ""], ["Close End Date", run?.to ?? ""]]}
    >
      {q.data && t && (
        <ReportTable head={["Rental#", "Reservation#", "Pickup Date", "Return Date", "Customer", "Company", "Total", "Paid", "Customer Balance", "Company Balance", "Total Balance"]} right={[6, 7, 8, 9, 10]}
          rows={q.data.rows.map((r) => [rental(r.id, r.raNumber), r.reservationNumber ?? "", ymd(r.pickup), ymd(r.return), r.customer, r.company, money(r.total), money(r.paid), money(r.customerBalance), money(r.companyBalance), money(r.totalBalance)])}
          foot={["Grand Total", "", "", "", "", "", money(t.total), money(t.paid), money(t.customerBalance), money(t.companyBalance), money(t.totalBalance)]} />
      )}
    </ReportFrame>
  );
}

/** Reservation A/R by Bills (ReportsCompanyInvoiceSummary.aspx). */
export function ReservationArReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ companyId: "", from: "", to: "", locationId: "", balance: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({
    ...trpc.staff.reports.reservationAr.queryOptions({ companyId: run?.companyId, from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId, balance: (run?.balance || "ALL") as "ALL" }),
    enabled: !!run,
    retry: false,
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Reservation A/R by Bills" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <SelectFilter id="rar-c" label="Company" value={v.companyId} onChange={set("companyId")} options={f.companies} />
        <DateField id="rar-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="rar-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="rar-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
        <SelectFilter id="rar-b" label="Balance" value={v.balance} onChange={set("balance")} options={BALANCE} />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && t && (
        <ReportTable head={["Reservation#", "Customer", "Company", "Reservation Date", "Pickup Date", "Location Code", "Amount Due", "Payments", "Balance", "PO#"]} right={[6, 7, 8]}
          rows={q.data.rows.map((r) => [reservation(r.id, r.number), r.customer, r.company, ymd(r.reservationDate), ymd(r.pickup), r.locationCode, money(r.due), money(r.paid), money(r.balance), r.po])}
          foot={["Grand Total", "", "", "", "", "", money(t.due), money(t.paid), money(t.balance), ""]} />
      )}
    </ReportFrame>
  );
}

/** Corporate A/R Analysis (ReportsCorporateARAnalysis.aspx). */
export function CorporateArAnalysisReport() {
  const trpc = useTRPC();
  const f = useReportFilters();
  const [v, setV] = React.useState({ from: "", to: "", locationId: "" });
  const [run, setRun] = React.useState<typeof v | null>(null);
  const q = useQuery({ ...trpc.staff.reports.corporateArAnalysis.queryOptions({ from: fromDay(run?.from ?? ""), to: fromDay(run?.to ?? ""), locationId: run?.locationId }), enabled: !!run, retry: false });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const t = q.data?.totals;
  return (
    <ReportFrame title="Corporate A/R Analysis" generated={!!run} onGenerate={() => setRun({ ...v })} loading={q.isLoading} error={q.error?.message}
      filters={<>
        <DateField id="cra-f" label="Begin Date" value={v.from} onChange={set("from")} />
        <DateField id="cra-t" label="End Date" value={v.to} onChange={set("to")} />
        <SelectFilter id="cra-l" label="Location" value={v.locationId} onChange={set("locationId")} options={f.locations} />
      </>}
      header={[["Begin Date", run?.from ?? ""], ["End Date", run?.to ?? ""]]}
    >
      {q.data && t && (
        <ReportTable head={["Company Name", "Less Than 30", "30 To 60 Days", "Aged More than 60 Days", "Total"]} right={[1, 2, 3, 4]}
          rows={q.data.rows.map((r) => [r.company, money(r.lt30), money(r.d30_60), money(r.gt60), money(r.total)])}
          foot={["Grand Total", money(t.lt30), money(t.d30_60), money(t.gt60), money(t.total)]} />
      )}
    </ReportFrame>
  );
}
