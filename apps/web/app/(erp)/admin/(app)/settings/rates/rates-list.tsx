"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date } from "@mrac/ui/lib/format";

const CALC: Record<string, string> = { HOUR_24: "24Hour", CALENDAR_DAY: "CalenderDay", FLAT: "Flat" };

/** Legacy Master Rates grid: Rate code · Location · Calculation by · Effective/End (or seasons) · Online · Active. */
export function RatesList({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [locationId, setLocationId] = React.useState(defaultLocationId ?? "");
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useQuery(trpc.staff.settings.rateList.queryOptions({ locationId: locationId || undefined, search: search || undefined }));

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rate code…" className="pl-8" aria-label="Search rates" />
        </div>
        <NativeSelect className="w-64" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {lookups?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
        <Button className="ml-auto" asChild><Link href="/admin/settings/rates/new"><PlusIcon /> New rate</Link></Button>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rate code</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rate type</TableHead>
              <TableHead>Length</TableHead>
              <TableHead>Calculation by</TableHead>
              <TableHead>Valid</TableHead>
              <TableHead className="text-right">Prices</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/admin/settings/rates/${r.id}`} className="font-medium text-primary hover:underline">{r.code}</Link></TableCell>
                <TableCell className="text-muted-foreground">{r.location.name}</TableCell>
                <TableCell>{r.rateType}</TableCell>
                <TableCell className="tabular-nums">{r.minDays || r.maxDays ? `${r.minDays}–${r.maxDays || "∞"} days` : "Any"}</TableCell>
                <TableCell>{CALC[r.calculationBy] ?? r.calculationBy}</TableCell>
                <TableCell className="max-w-56 truncate">
                  {r.validFor === "SEASON" ? r.seasons.map((s) => s.season.name).join(", ") || "—" : `${date(r.effectiveDate)} – ${date(r.endDate)}`}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r._count.values}</TableCell>
                <TableCell>{r.displayOnline ? <Badge variant="info">Yes</Badge> : "No"}</TableCell>
                <TableCell>{r.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
