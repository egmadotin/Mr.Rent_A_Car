"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, PrinterIcon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { cn } from "@mrac/ui/lib/utils";
import { ConfirmAction } from "../../../_components/confirm-action";
import { ListStatusRow } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";

type Filters = { search?: string; number?: string; firstName?: string; lastName?: string; phone?: string; from?: string; to?: string; locationId?: string };

/** "12/13/2024 2:46:11 PM", as RentCentric lists the Quote Date. */
const listDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(d)).replace(",", "");

/**
 * QuotesSearch.aspx: quick search (Quote # OR First Name OR Last Name), Advanced Search (Quote#, Quote Date Start/End,
 * Location, First Name, Last Name, Phone), columns Quote# (+ Expired), Quote Date, Full Name, Phone, Location Name, Delete,
 * then Print / Export to Excel. Filters apply when Search is pressed.
 */
export function QuotesList({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const locations = useQuery(trpc.staff.meta.activeLocations.queryOptions()).data;
  const [advanced, setAdvanced] = React.useState(false);
  const [draft, setDraft] = React.useState<Filters>({ locationId: defaultLocationId });
  const [filters, setFilters] = React.useState<Filters>({ locationId: defaultLocationId });
  const [paging, setPaging] = React.useState({ page: 1, pageSize: 200 });
  const [deleting, setDeleting] = React.useState<{ id: string; number: number } | null>(null);

  const apply = (f: Filters) => {
    setFilters(f);
    setPaging((p) => ({ ...p, page: 1 }));
  };
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const none = (v?: string) => (v?.trim() ? v.trim() : undefined);

  const { data, isLoading } = useQuery({
    ...trpc.staff.quote.list.queryOptions({
      search: none(filters.search),
      number: none(filters.number),
      firstName: none(filters.firstName),
      lastName: none(filters.lastName),
      phone: none(filters.phone),
      from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined,
      locationId: none(filters.locationId),
      ...paging,
    }),
    placeholderData: keepPreviousData,
  });

  function exportExcel() {
    const rows = [["Quote#", "Quote Date", "Full Name", "Phone", "Location Name"], ...(data?.rows ?? []).map((q) => [String(q.number), listDate(q.createdAt), q.fullName ?? "", q.phone ?? "", q.locationName])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "Quotes.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3 p-4 md:p-6">
      <Card className="gap-0 p-3 print:hidden">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ ...filters, search: draft.search });
          }}
        >
          <Button type="button" variant="outline" onClick={() => setAdvanced((x) => !x)} aria-expanded={advanced}>
            Advanced Search <ChevronDownIcon className={cn("transition-transform", advanced && "rotate-180")} />
          </Button>
          <Input className="min-w-64 flex-1" value={draft.search ?? ""} onChange={set("search")} placeholder="Quote # OR First Name OR Last Name" aria-label="Quote # OR First Name OR Last Name" />
          <Button type="submit">Search</Button>
        </form>
        {advanced && (
          <form
            className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ ...draft });
            }}
          >
            <div className="space-y-1.5"><Label htmlFor="q-number">Quote#</Label><Input id="q-number" value={draft.number ?? ""} onChange={set("number")} /></div>
            <div className="space-y-1.5"><Label htmlFor="q-from">Quote Date Start</Label><Input id="q-from" type="date" value={draft.from ?? ""} onChange={set("from")} /></div>
            <div className="space-y-1.5"><Label htmlFor="q-to">End</Label><Input id="q-to" type="date" value={draft.to ?? ""} onChange={set("to")} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="q-loc">Location</Label>
              <NativeSelect id="q-loc" value={draft.locationId ?? ""} onChange={set("locationId")}>
                <option value="">ALL</option>
                {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="q-first">First Name</Label><Input id="q-first" value={draft.firstName ?? ""} onChange={set("firstName")} /></div>
            <div className="space-y-1.5"><Label htmlFor="q-last">Last Name</Label><Input id="q-last" value={draft.lastName ?? ""} onChange={set("lastName")} /></div>
            <div className="space-y-1.5"><Label htmlFor="q-phone">Phone</Label><Input id="q-phone" value={draft.phone ?? ""} onChange={set("phone")} /></div>
            <div className="flex items-end"><Button type="submit" className="w-full">Search</Button></div>
          </form>
        )}
      </Card>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote#</TableHead>
              <TableHead>Quote Date</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location Name</TableHead>
              <TableHead className="w-16 text-center print:hidden">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={6} loading={isLoading} empty={data?.rows.length === 0} emptyText="No Records Found" />
            {data?.rows.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <Link href={`/admin/quotes/${q.id}`} className="font-medium text-primary hover:underline">{q.number}</Link>
                  {q.expired && <span className="ml-1 text-destructive">Expired</span>}
                </TableCell>
                <TableCell>{listDate(q.createdAt)}</TableCell>
                <TableCell>{q.fullName}</TableCell>
                <TableCell>{q.phone}</TableCell>
                <TableCell>{q.locationName}</TableCell>
                <TableCell className="text-center print:hidden">
                  <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={`Delete quote ${q.number}`} onClick={() => setDeleting({ id: q.id, number: q.number })}>
                    <XIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}><PrinterIcon /> Print</Button>
        <Button variant="outline" size="sm" onClick={exportExcel}>Export to Excel</Button>
      </div>

      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete quote"
        description={<>Delete quote #{deleting?.number}? Reservations made from it are not affected.</>}
        confirmLabel="Delete quote"
        onConfirm={async () => {
          await client.staff.quote.delete.mutate({ quoteId: deleting!.id });
          await qc.invalidateQueries({ queryKey: trpc.staff.quote.list.queryKey() });
        }}
      />
    </div>
  );
}
