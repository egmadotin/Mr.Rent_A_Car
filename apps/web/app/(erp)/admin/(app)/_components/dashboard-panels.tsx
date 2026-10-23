"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { cn } from "@mrac/ui/lib/utils";
import { DashCard, FleetMix, ForecastChart, LocationsCard, Pipeline, RecentActivity, RevenueChart, TypeTable } from "./dashboard-insights";

const time = (d: string | Date) => new Date(d).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
const day = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

const Empty = ({ text = "No Records Found" }: { text?: string }) => <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">{text}</p>;

/** The dashboard below the KPIs: charts, today's operations, pipeline, fleet, vehicle types, locations and the latest bookings. */
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
      <div className="grid gap-6 xl:grid-cols-2">
        <LocationsCard />
        <RecentActivity />
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
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", t.key === "late" && t.count ? "bg-destructive text-destructive-foreground" : "bg-background text-muted-foreground")}>{t.count}</span>
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
