"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toDateTimeLocal } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { AddTaskButton, TaskTable } from "../../../_components/tasks";

const time = (d: string | Date) => new Date(d).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
const day = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="flex items-center gap-2 font-serif text-lg">{title}{count != null && count > 0 && <Badge variant="muted">{count}</Badge>}</CardTitle></CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}
const Empty = () => <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">No Records Found</p>;

/** RentCentric dashboard panels: Rentals Leaving Today, Returning Today, Vehicles Requiring Service, Rental Graph View, Vehicle Availability. */
export function DashboardPanels() {
  const trpc = useTRPC();
  const [days, setDays] = React.useState<7 | 14 | 30>(7);
  const d = useQuery(trpc.staff.meta.dashboard.queryOptions({ days }, { placeholderData: (p) => p })).data;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Panel title="Rentals Leaving Today" count={d?.leaving.length}>
          {!d?.leaving.length ? <Empty /> : (
            <ul className="divide-y text-sm">
              {d.leaving.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/reservations/${r.id}`} className="font-medium text-primary hover:underline">#{r.number} · {r.name || "—"}</Link>
                  <span className="text-muted-foreground">{time(r.at)} · {r.vehicleType} · {r.location}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Returning Today" count={d?.returning.length}>
          {!d?.returning.length ? <Empty /> : (
            <ul className="divide-y text-sm">
              {d.returning.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/rentals/${r.id}`} className="font-medium text-primary hover:underline">RA #{r.raNumber} · {r.name}</Link>
                  <span className={cn("text-muted-foreground", r.overdue && "font-medium text-destructive")}>{r.overdue ? `Overdue since ${day(r.at)} ${time(r.at)}` : time(r.at)} · {r.vehicle}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <MyTasks />
        <Panel title="Vehicles Requiring Service" count={d?.service.length}>
          {!d?.service.length ? <Empty /> : (
            <ul className="divide-y text-sm">
              {d.service.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-primary hover:underline">{v.assignedId} · {v.vehicle}</Link>
                  <span className="text-muted-foreground">
                    {v.reason === "status"
                      ? v.status.replaceAll("_", " ").toLowerCase()
                      : v.kmLeft != null && v.kmLeft <= 0 ? `Service due (${v.dueAtKm?.toLocaleString()} km)` : `${v.kmLeft?.toLocaleString()} km to service`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-6">
        <Card className="gap-2 py-4">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 px-4">
            <CardTitle className="font-serif text-lg">Rental Graph View</CardTitle>
            <div className="flex gap-1" role="group" aria-label="Period">
              {([[7, "7 Days"], [14, "14 Days"], [30, "1 Month"]] as const).map(([n, label]) => (
                <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)} aria-pressed={days === n}>{label}</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {d?.graph.map((g) => (
              <div key={String(g.date)} className="grid grid-cols-[3.5rem_1fr_2.75rem] items-center gap-2 text-sm">
                <span className="text-muted-foreground">{day(g.date)}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted" title={`${g.booked} booked`}>
                  <div className="h-full rounded-full bg-forest-100" style={{ width: `${Math.max(g.percent, 2)}%` }} />
                </div>
                <span className="text-right text-xs tabular-nums text-muted-foreground">{g.percent}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Availability />
      </div>
    </div>
  );
}

/** Dashboard "My Tasks": my open tasks, with Add Task. */
function MyTasks() {
  const trpc = useTRPC();
  const tasks = (useQuery(trpc.staff.tasks.list.queryOptions({ mine: true, status: "OPEN" })).data ?? []).slice(0, 8);
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="flex items-center gap-2 font-serif text-lg">My Tasks{tasks.length > 0 && <Badge variant="muted">{tasks.length}</Badge>}</CardTitle>
        <span className="flex items-center gap-3"><Link href="/admin/tasks" className="text-sm text-primary hover:underline">All tasks</Link><AddTaskButton /></span>
      </CardHeader>
      <CardContent className="px-0"><TaskTable tasks={tasks} compact /></CardContent>
    </Card>
  );
}

function Availability() {
  const trpc = useTRPC();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const locations = (lookups?.locations ?? []).filter((l) => l.isActive);
  const types = useQuery(trpc.staff.settings.vehicleTypeList.queryOptions()).data ?? [];
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const [f, setF] = React.useState({ locationId: "", vehicleTypeId: "", assignedId: "", from: toDateTimeLocal(new Date(+now + 3_600_000)), to: toDateTimeLocal(new Date(+now + 25 * 3_600_000)) });
  const [search, setSearch] = React.useState<typeof f | null>(null);
  const loc = f.locationId || locations[0]?.id || "";
  const res = useQuery({
    ...trpc.staff.meta.availability.queryOptions({ locationId: search?.locationId || loc, vehicleTypeId: search?.vehicleTypeId || undefined, assignedId: search?.assignedId || undefined, from: new Date(search?.from ?? f.from), to: new Date(search?.to ?? f.to) }),
    enabled: !!search,
  });

  return (
    <Panel title="Vehicle Availability">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ ...f, locationId: loc });
        }}
      >
        <NativeSelect aria-label="Location" value={loc} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Vehicle type" value={f.vehicleTypeId} onChange={(e) => setF({ ...f, vehicleTypeId: e.target.value })}>
          <option value="">Select Vehicle Type</option>
          {types.filter((t) => t.isActive).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </NativeSelect>
        <div className="space-y-1"><Label htmlFor="av-from">From</Label><Input id="av-from" type="datetime-local" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} required /></div>
        <div className="space-y-1"><Label htmlFor="av-to">To</Label><Input id="av-to" type="datetime-local" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} required /></div>
        <Input aria-label="Vehicle ID" placeholder="Vehicle ID" value={f.assignedId} onChange={(e) => setF({ ...f, assignedId: e.target.value })} />
        <Button type="submit"><SearchIcon /> Search</Button>
      </form>
      {search && (
        <div className="mt-4 text-sm">
          {res.error ? <p className="text-destructive">{res.error.message}</p> : res.isLoading ? <p className="text-muted-foreground">Searching…</p> : !res.data?.length ? <Empty /> : (
            <>
              <p className="mb-1 text-muted-foreground">{res.data.length} available</p>
              <ul className="divide-y">
                {res.data.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-primary hover:underline">{v.assignedId} · {v.year} {v.make.name} {v.model.name}</Link>
                    <span className="text-muted-foreground">{v.vehicleType.name}{v.licenseNumber ? ` · ${v.licenseNumber}` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
