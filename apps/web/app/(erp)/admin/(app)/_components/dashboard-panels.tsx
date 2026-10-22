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
import { DashCard, FleetMix, ForecastChart, LocationsCard, Pipeline, RecentActivity, RevenueChart, TypeTable } from "./dashboard-insights";

const time = (d: string | Date) => new Date(d).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
const day = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

const Empty = ({ text = "No Records Found" }: { text?: string }) => <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">{text}</p>;

/** The dashboard below the KPIs: charts, today's operations, pipeline, fleet, locations, activity, tasks, service, availability. */
export function DashboardPanels() {
  const trpc = useTRPC();
  const d = useQuery(trpc.staff.meta.dashboard.queryOptions({ days: 7 }, { refetchInterval: 60_000 })).data;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><RevenueChart /></div>
        <FleetMix />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2"><TodayOps d={d} /></div>
        <Pipeline />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ForecastChart />
        <TypeTable />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <LocationsCard />
        <RecentActivity />
        <MyTasks />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <DashCard title={<>Vehicles requiring service{!!d?.service.length && <Badge variant="muted">{d.service.length}</Badge>}</>}>
          {!d?.service.length ? <Empty /> : (
            <ul className="divide-y text-sm">
              {d.service.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-primary hover:underline">{v.assignedId} · {v.vehicle}</Link>
                  <span className={cn("text-muted-foreground", v.kmLeft != null && v.kmLeft <= 0 && "font-medium text-destructive")}>
                    {v.reason === "status"
                      ? v.status.replaceAll("_", " ").toLowerCase()
                      : v.kmLeft != null && v.kmLeft <= 0 ? `Service due (${v.dueAtKm?.toLocaleString()} km)` : `${v.kmLeft?.toLocaleString()} km to service`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DashCard>
        <Availability />
      </div>
    </div>
  );
}

type DashData = { leaving: { id: string; number: number; at: string | Date; name: string; vehicleType: string; location: string }[]; returning: { id: string; raNumber: number; at: string | Date; overdue: boolean; name: string; vehicle: string; location: string }[] };

/** Today's operations: pick-ups, returns due and overdue rentals, one tab each. */
function TodayOps({ d }: { d: DashData | undefined }) {
  const [tab, setTab] = React.useState<"out" | "in" | "late">("out");
  const returns = d?.returning.filter((r) => !r.overdue) ?? [];
  const late = d?.returning.filter((r) => r.overdue) ?? [];
  const tabs = [
    { key: "out" as const, label: "Pick-ups today", count: d?.leaving.length ?? 0 },
    { key: "in" as const, label: "Returns today", count: returns.length },
    { key: "late" as const, label: "Overdue", count: late.length },
  ];
  return (
    <DashCard
      title="Today's operations"
      action={
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors", tab === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", t.key === "late" && t.count ? "bg-destructive text-white" : "bg-background text-muted-foreground")}>{t.count}</span>
            </button>
          ))}
        </div>
      }
    >
      {tab === "out" && (!d?.leaving.length ? <Empty text="No pick-ups scheduled today." /> : (
        <Rows rows={d.leaving.map((r) => ({ key: r.id, time: time(r.at), href: `/admin/reservations/${r.id}`, title: `Res #${r.number} · ${r.name || "—"}`, meta: `${r.vehicleType} · ${r.location}` }))} />
      ))}
      {tab === "in" && (!returns.length ? <Empty text="No returns due today." /> : (
        <Rows rows={returns.map((r) => ({ key: r.id, time: time(r.at), href: `/admin/rentals/${r.id}`, title: `RA #${r.raNumber} · ${r.name}`, meta: `${r.vehicle} · ${r.location}` }))} />
      ))}
      {tab === "late" && (!late.length ? <Empty text="Nothing overdue." /> : (
        <Rows late rows={late.map((r) => ({ key: r.id, time: `${day(r.at)} ${time(r.at)}`, href: `/admin/rentals/${r.id}`, title: `RA #${r.raNumber} · ${r.name}`, meta: `${r.vehicle} · ${r.location}` }))} />
      ))}
    </DashCard>
  );
}

function Rows({ rows, late }: { rows: { key: string; time: string; href: string; title: string; meta: string }[]; late?: boolean }) {
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 py-2.5">
          <span className={cn("w-24 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold tabular-nums", late ? "bg-destructive/10 text-destructive" : "bg-muted")}>{r.time}</span>
          <div className="min-w-0 flex-1">
            <Link href={r.href} className="block truncate font-medium text-primary hover:underline">{r.title}</Link>
            <span className="block truncate text-xs text-muted-foreground">{r.meta}</span>
          </div>
        </li>
      ))}
    </ul>
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
    <DashCard title="Vehicle availability">
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
    </DashCard>
  );
}
