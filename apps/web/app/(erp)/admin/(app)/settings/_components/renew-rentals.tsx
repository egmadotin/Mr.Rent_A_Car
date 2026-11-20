"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcwIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { errorMessage } from "../../../../_components/form";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv, legacyDate } from "../../../../_components/list-kit";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

type Row = { id: string; raNumber: number; customer: string; unit: string; vehicleStatus: string; location: string; checkOutAt: Date | string; checkedInAt: Date | string | null; timeZone: string };

/** Settings > Import Data and Other Tools > Renew Rental Agreements: closed agreements, each with Re-open. */
export function RenewRentals() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.reports.filters.queryOptions()).data?.locations ?? [];
  const [quick, setQuick] = React.useState("");
  const [filters, setFilters] = React.useState<{ q?: string; locationId?: string; from?: string; to?: string }>({});
  const [adv, setAdv] = React.useState<typeof filters>({});
  const allowed = can("chkAllowReOpenRentals");
  const q = useQuery({ ...trpc.staff.renew.closed.queryOptions(filters), enabled: allowed });
  const [reopen, setReopen] = React.useState<Row | null>(null);
  const rows = q.data ?? [];
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAdv((a) => ({ ...a, [k]: e.target.value || undefined }));

  if (can.me && !allowed) return <p className="p-6 text-sm text-muted-foreground">Your user group can&apos;t re-open rentals (Allow ReOpen Rentals). {NO_PERMISSION}</p>;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <LegacySearchBar placeholder="Rental #, customer name or unit #" quick={quick} onQuickChange={setQuick} onSearch={(m) => setFilters(m === "quick" ? { q: quick.trim() || undefined } : { ...adv, q: quick.trim() || undefined })}>
        <SearchField label="Location" id="s-loc"><NativeSelect id="s-loc" onChange={set("locationId")}><option value="" />{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect></SearchField>
        <SearchField label="Closed From" id="s-from"><Input id="s-from" type="date" onChange={set("from")} /></SearchField>
        <SearchField label="To" id="s-to"><Input id="s-to" type="date" onChange={set("to")} /></SearchField>
      </LegacySearchBar>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Rental #</TableHead><TableHead>Customer</TableHead><TableHead>Unit #</TableHead><TableHead>Location</TableHead><TableHead>Checked Out</TableHead><TableHead>Checked In</TableHead><TableHead className="text-right">Renew</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={7} loading={q.isLoading} empty={!rows.length} emptyText="No closed rental agreements match." />
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/admin/rentals/${r.id}`} className="font-medium text-primary hover:underline">{r.raNumber}</Link></TableCell>
                <TableCell>{r.customer}</TableCell>
                <TableCell>{r.unit} {r.vehicleStatus === "ON_RENT" && <Badge variant="warning">on rent now</Badge>}</TableCell>
                <TableCell>{r.location}</TableCell>
                <TableCell>{legacyDate(r.checkOutAt, { timeZone: r.timeZone })}</TableCell>
                <TableCell>{legacyDate(r.checkedInAt, { timeZone: r.timeZone })}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setReopen(r)}><RotateCcwIcon /> Re-open</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListExportButtons onExport={() => exportCsv("closed-rentals.csv", ["Rental #", "Customer", "Unit #", "Location", "Checked Out", "Checked In"], rows.map((r) => [r.raNumber, r.customer, r.unit, r.location, legacyDate(r.checkOutAt, { timeZone: r.timeZone }), legacyDate(r.checkedInAt, { timeZone: r.timeZone })]))} />
      <ConfirmAction
        open={!!reopen}
        onOpenChange={(x) => !x && setReopen(null)}
        title={`Re-open rental ${reopen?.raNumber}?`}
        description={`It goes back to Open and unit ${reopen?.unit} back to On Rent${reopen?.vehicleStatus === "ON_RENT" ? " — note: that unit is on another rental right now" : ""}. Close it again from the rental when done.`}
        confirmLabel="Re-open"
        onConfirm={async () => {
          try {
            await client.staff.rental.reopen.mutate({ rentalId: reopen!.id });
            await qc.invalidateQueries({ queryKey: trpc.staff.renew.closed.queryKey() });
            toast.success(`Rental ${reopen!.raNumber} re-opened`);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
