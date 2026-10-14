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
import { money } from "@mrac/ui/lib/format";

const CALC_LABEL: Record<string, string> = { HOUR_24: "24Hour", CALENDAR_DAY: "CalenderDay", FLAT: "Flat", PERCENT: "Percentage" };

/** Misc Charges / Insurance Coverage list — same columns as the legacy grids, plus online/default flags. */
export function ChargeList({ kind, defaultLocationId }: { kind: "misc" | "insurance"; defaultLocationId?: string }) {
  const trpc = useTRPC();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [locationId, setLocationId] = React.useState(defaultLocationId ?? "");
  const [search, setSearch] = React.useState("");
  const [active, setActive] = React.useState<"all" | "yes" | "no">("all");
  const input = { locationId: locationId || undefined, search: search || undefined, active: active === "all" ? undefined : active === "yes" };
  const misc = useQuery({ ...trpc.staff.settings.miscList.queryOptions(input), enabled: kind === "misc" });
  const ins = useQuery({ ...trpc.staff.settings.insuranceList.queryOptions(input), enabled: kind === "insurance" });
  const base = kind === "misc" ? "/admin/settings/misc-charges" : "/admin/settings/insurances";
  const rows = kind === "misc"
    ? (misc.data ?? []).map((m) => ({ id: m.id, name: m.name, code: m.code, price: m.calculationBy === "PERCENT" ? `${Number(m.rate)}%` : money(m.rate), calc: CALC_LABEL[m.calculationBy], active: m.isActive, online: m.displayOnline, isDefault: m.isDefault, extra: m.isMandatory ? "Mandatory" : null, group: m.group, location: m.location?.name ?? "All" }))
    : (ins.data ?? []).map((i) => ({ id: i.id, name: i.name, code: i.code, price: money(i.dailyRate), calc: i.deductible && Number(i.deductible) > 0 ? `${money(i.deductible)} ded.` : "", active: i.isActive, online: i.displayOnline, isDefault: i.isDefault, extra: null, group: i.group, location: i.location?.name ?? "All" }));
  const loading = kind === "misc" ? misc.isLoading : ins.isLoading;

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code…" className="pl-8" aria-label="Search" />
        </div>
        <NativeSelect className="w-64" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {lookups?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
        <NativeSelect className="w-32" value={active} onChange={(e) => setActive(e.target.value as "all")} aria-label="Active">
          <option value="all">All</option>
          <option value="yes">Active</option>
          <option value="no">Inactive</option>
        </NativeSelect>
        <Button className="ml-auto" asChild><Link href={`${base}/new`}><PlusIcon /> {kind === "misc" ? "New misc. charge" : "New coverage"}</Link></Button>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{kind === "misc" ? "Misc. charge" : "Insurance"}</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">{kind === "misc" ? "Rate" : "Daily rate"}</TableHead>
              <TableHead>{kind === "misc" ? "Calculation by" : "Deductible"}</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nothing matches.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`${base}/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link></TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">{r.code}</TableCell>
                <TableCell className="text-right tabular-nums">{r.price}</TableCell>
                <TableCell>{r.calc}</TableCell>
                <TableCell className="text-muted-foreground">{r.location}</TableCell>
                <TableCell className="space-x-1">
                  {r.online && <Badge variant="info">Online</Badge>}
                  {r.isDefault && <Badge variant="success">Default</Badge>}
                  {r.extra && <Badge variant="warning">{r.extra}</Badge>}
                  {r.group && <Badge variant="outline">{r.group}</Badge>}
                </TableCell>
                <TableCell>{r.active ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-3 py-2 text-sm text-muted-foreground">{rows.length} items</div>
      </Card>
    </div>
  );
}
