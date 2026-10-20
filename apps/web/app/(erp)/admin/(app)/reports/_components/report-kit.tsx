"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PrinterIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { cn } from "@mrac/ui/lib/utils";

export const money = (n: number) => (n === 0 ? "0.00" : n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const ymd = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("en-CA") : "");
export const ymdhm = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
/** "2026-10-20" from a date input, as a local midnight Date (the API adds the end-of-day itself). */
export const fromDay = (s: string) => (s ? new Date(`${s}T00:00`) : undefined);

export function useReportFilters() {
  const trpc = useTRPC();
  return useQuery(trpc.staff.reports.filters.queryOptions()).data ?? { locations: [], makes: [], types: [], companies: [], referrals: [], regions: [], agents: [] };
}

export function DateField({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
export function SelectFilter({ label, value, onChange, options, all = "All", id }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; name: string }[] | { value: string; label: string }[]; all?: string | false; id: string }) {
  const opts = (options as ({ id: string; name: string } | { value: string; label: string })[]).map((o) => ("id" in o ? { value: o.id, label: o.name } : o));
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {all !== false && <option value="">{all}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}

/** RentCentric report page: the filter form with Generate, then the printable report (header block, table, totals). */
export function ReportFrame({
  title,
  filters,
  onGenerate,
  generated,
  header,
  error,
  loading,
  children,
}: {
  title: string;
  filters: React.ReactNode;
  onGenerate: () => void;
  generated: boolean;
  header: [string, React.ReactNode][];
  error?: string | null;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const now = React.useMemo(() => new Date(), [generated]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="py-4 print:hidden">
        <CardContent className="space-y-4 px-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{filters}</div>
          <div className="flex justify-end gap-2">
            {generated && <Button variant="outline" onClick={() => window.print()}><PrinterIcon /> Print</Button>}
            <Button onClick={onGenerate}>Generate</Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
      {generated && !error && (
        <div className="overflow-x-auto rounded-md border bg-white p-4 text-[12px] text-black print:border-0 print:p-0">
          <h2 className="mb-3 text-center text-xl font-bold">{title}</h2>
          <dl className="mb-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {[...header, ["Date", ymdhm(now)] as [string, React.ReactNode]].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] gap-2"><dt className="font-semibold">{k}</dt><dd>{v || ""}</dd></div>
            ))}
          </dl>
          {loading ? <p className="text-muted-foreground">Loading…</p> : children}
        </div>
      )}
    </div>
  );
}

/** A plain report table: underlined bold headings like RentCentric's printouts. */
export function ReportTable({ head, rows, right = [], foot }: { head: string[]; rows: React.ReactNode[][]; right?: number[]; foot?: React.ReactNode[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>{head.map((h, i) => <th key={h + i} className={cn("border-b border-black px-1 py-1 text-left font-bold underline", right.includes(i) && "text-right")}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={head.length} className="px-1 py-2 text-muted-foreground">No records</td></tr>}
        {rows.map((r, j) => <tr key={j} className="align-top">{r.map((c, i) => <td key={i} className={cn("px-1 py-0.5", right.includes(i) && "text-right tabular-nums")}>{c}</td>)}</tr>)}
      </tbody>
      {foot && <tfoot><tr className="border-t border-black font-bold">{foot.map((c, i) => <td key={i} className={cn("px-1 py-1", right.includes(i) && "text-right tabular-nums")}>{c}</td>)}</tr></tfoot>}
    </table>
  );
}
