"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../_components/confirm-action";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv, legacyDate } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";

type Filters = { search?: string; number?: string; firstName?: string; lastName?: string; phone?: string; from?: string; to?: string; locationId?: string };
const none = (v?: string) => (v?.trim() ? v.trim() : undefined);

/**
 * QuotesSearch.aspx: quick search (Quote # OR First Name OR Last Name), Advanced Search (Quote#, Quote Date Start/End,
 * Location, First Name, Last Name, Phone), columns Quote# (+ Expired), Quote Date, Full Name, Phone, Location Name, Delete,
 * then Print / Export to Excel.
 */
export function QuotesList({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const locations = useQuery(trpc.staff.meta.activeLocations.queryOptions()).data;
  const [draft, setDraft] = React.useState<Filters>({ locationId: defaultLocationId });
  const [filters, setFilters] = React.useState<Filters>({ locationId: defaultLocationId });
  const [paging, setPaging] = React.useState({ page: 1, pageSize: 200 });
  const [deleting, setDeleting] = React.useState<{ id: string; number: number } | null>(null);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

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

  return (
    <div className="space-y-3 p-4 md:p-6">
      <LegacySearchBar
        placeholder="Quote # OR First Name OR Last Name"
        quick={draft.search ?? ""}
        onQuickChange={(v) => setDraft((d) => ({ ...d, search: v }))}
        onSearch={(mode) => {
          setFilters(mode === "quick" ? { ...filters, search: draft.search } : { ...draft });
          setPaging((p) => ({ ...p, page: 1 }));
        }}
      >
        <SearchField label="Quote#" id="q-number"><Input id="q-number" value={draft.number ?? ""} onChange={set("number")} /></SearchField>
        <SearchField label="Quote Date Start" id="q-from"><Input id="q-from" type="date" value={draft.from ?? ""} onChange={set("from")} /></SearchField>
        <SearchField label="End" id="q-to"><Input id="q-to" type="date" value={draft.to ?? ""} onChange={set("to")} /></SearchField>
        <SearchField label="Location" id="q-loc">
          <NativeSelect id="q-loc" value={draft.locationId ?? ""} onChange={set("locationId")}>
            <option value="">ALL</option>
            {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </SearchField>
        <SearchField label="First Name" id="q-first"><Input id="q-first" value={draft.firstName ?? ""} onChange={set("firstName")} /></SearchField>
        <SearchField label="Last Name" id="q-last"><Input id="q-last" value={draft.lastName ?? ""} onChange={set("lastName")} /></SearchField>
        <SearchField label="Phone" id="q-phone"><Input id="q-phone" value={draft.phone ?? ""} onChange={set("phone")} /></SearchField>
      </LegacySearchBar>

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
                <TableCell>{legacyDate(q.createdAt, { seconds: true })}</TableCell>
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
      <ListExportButtons
        onExport={() =>
          exportCsv("Quotes.csv", ["Quote#", "Quote Date", "Full Name", "Phone", "Location Name"], (data?.rows ?? []).map((q) => [q.number, legacyDate(q.createdAt, { seconds: true }), q.fullName, q.phone, q.locationName]))
        }
      />

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
