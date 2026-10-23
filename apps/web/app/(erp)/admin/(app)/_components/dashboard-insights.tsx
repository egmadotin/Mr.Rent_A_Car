"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRightIcon, ArrowUpRightIcon, BanknoteIcon, CalendarClockIcon, CarFrontIcon, GaugeIcon, GlobeIcon, ReceiptIcon, WalletIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { cn } from "@mrac/ui/lib/utils";

const money = (n: number, digits = 0) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: digits, minimumFractionDigits: digits });
const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);
const day = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const weekday = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { weekday: "short" });
const title = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function DashCard({ title: t, action, children, className }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 px-4">
        <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">{t}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}

function Kpi({ label, value, sub, icon: Icon, trend, children, href }: {
  label: string; value: string; sub?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; trend?: number | null; children?: React.ReactNode; href?: string;
}) {
  const body = (
    <Card className={cn("h-full gap-2 p-4", href && "transition-shadow hover:shadow-lift")}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
        <span className="grid size-8 place-items-center rounded-control bg-muted text-foreground"><Icon className="size-4" /></span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tracking-tight text-3xl font-bold tabular-nums">{value}</span>
        {trend != null && (
          <span className={cn("inline-flex items-center text-xs font-semibold", trend >= 0 ? "text-success" : "text-destructive")}>
            {trend >= 0 ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {children}
    </Card>
  );
  return href ? <Link href={href} className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link> : body;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 200, h = 36;
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - 2 - (v / max) * (h - 4)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} className="fill-steel/10" />
      <polyline points={pts.join(" ")} fill="none" className="stroke-steel" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Meter({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full bg-success", className)} style={{ width: `${Math.min(100, Math.max(percent, percent > 0 ? 2 : 0))}%` }} />
    </div>
  );
}

/** A single-series column chart with a hover tooltip; values are labelled on hover only. */
function Columns({ data, format, height = 180, barClass = "fill-steel", ariaLabel }: {
  data: { label: string; sub?: string; value: number; tip: string }[]; format: (n: number) => string; height?: number; barClass?: string; ariaLabel: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const nice = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    const s = [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m * 4 >= max) ?? max;
    return s * 4;
  })();
  const W = 600, H = height, padL = 44, padB = 22, padT = 8;
  const plotH = H - padB - padT, plotW = W - padL;
  const step = plotW / data.length;
  const bw = Math.max(2, step - 2);
  const every = Math.ceil(data.length / 8);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = padT + plotH - (i / 4) * plotH;
          return (
            <g key={i}>
              <line x1={padL} x2={W} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{format((nice / 4) * i)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / nice) * plotH;
          const x = padL + i * step + 1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" />
              {h > 0 && <path d={bar(x, padT + plotH - h, bw, h)} className={cn(barClass, hover != null && hover !== i && "opacity-50")} />}
              {i % every === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((padL + hover * step + step / 2) / W) * 100}%` }}
        >
          <div className="font-semibold">{data[hover].sub ?? data[hover].label}</div>
          <div className="text-muted-foreground">{data[hover].tip}</div>
        </div>
      )}
    </div>
  );
}
/** A column with a 4px rounded top, square at the baseline. */
function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Vehicle statuses grouped for the fleet bar: each group keeps one colour wherever it appears. */
const STATUS_GROUPS = [
  { key: "available", label: "Available", className: "bg-success", match: ["AVAILABLE"] },
  { key: "rent", label: "On rent", className: "bg-status-reservation", match: ["ON_RENT", "IN_CHECKOUT_PROCESS"] },
  { key: "service", label: "Service / repair", className: "bg-status-unassigned", match: ["IN_SERVICE", "IN_REPAIR", "HAS_PROBLEM", "COMPREHENSIVE"] },
  { key: "out", label: "Out of service", className: "bg-status-overdue", match: ["OUT_OF_SERVICE", "GROUNDED", "STOLEN"] },
  { key: "other", label: "Other", className: "bg-muted-foreground/50", match: [] as string[] },
];

export function useInsights() {
  const trpc = useTRPC();
  return useQuery(trpc.staff.meta.insights.queryOptions(undefined, { refetchInterval: 120_000 })).data;
}

/** The four headline KPIs. */
export function KpiRow({ onRent, inFleet, overdue }: { onRent: number; inFleet: number; overdue: number }) {
  const d = useInsights();
  const r = d?.revenue;
  const util = inFleet ? Math.round((onRent / inFleet) * 100) : 0;
  return (
    <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Revenue · month to date" value={r ? money(r.mtd) : "—"} trend={r?.change} icon={BanknoteIcon} href="/admin/reports/month-to-date"
        sub={r ? <>{r.rentalsMtd} rentals · {money(r.prevSamePeriod)} same days last month</> : null}>
        {r && <Sparkline values={r.daily.map((x) => x.revenue)} />}
      </Kpi>
      <Kpi label="Fleet utilization" value={`${util}%`} icon={GaugeIcon} href="/admin/calendar"
        sub={<>{onRent} of {inFleet} vehicles on rent{overdue ? <span className="font-semibold text-destructive"> · {overdue} overdue</span> : null}</>}>
        <div className="mt-2"><Meter percent={util} /></div>
      </Kpi>
      <Kpi label="Avg daily rate · MTD" value={r ? money(r.avgDailyRate, 2) : "—"} icon={ReceiptIcon}
        sub={r ? <>Avg rental {r.avgLength.toFixed(1)} days · collected {money(r.collected)}</> : null} />
      <Kpi label="Balance owing" value={d ? money(d.owed.amount) : "—"} icon={WalletIcon} href="/admin/reports/customer-ar"
        sub={d ? <>{d.owed.count} rental{d.owed.count === 1 ? "" : "s"} with a balance (last 12 months)</> : null} />
    </section>
  );
}

export function RevenueChart() {
  const d = useInsights();
  const total = d?.revenue.daily.reduce((a, x) => a + x.revenue, 0) ?? 0;
  return (
    <DashCard title="Revenue · last 30 days" action={d && <span className="text-sm text-muted-foreground">{money(total)} booked</span>}>
      {d ? (
        <Columns ariaLabel="Revenue booked per day, last 30 days" format={short}
          data={d.revenue.daily.map((x) => ({ label: day(x.date), sub: `${weekday(x.date)}, ${day(x.date)}`, value: x.revenue, tip: `${money(x.revenue)} · ${x.rentals} rental${x.rentals === 1 ? "" : "s"}` }))} />
      ) : <div className="h-44 animate-pulse rounded-md bg-muted" />}
      <p className="mt-1 text-xs text-muted-foreground">Rental charges before tax, by pick-up day.</p>
    </DashCard>
  );
}

export function FleetMix() {
  const d = useInsights();
  const groups = STATUS_GROUPS.map((g) => ({
    ...g, count: (d?.fleetByStatus ?? []).filter((s) => (g.match.length ? g.match.includes(s.status) : !STATUS_GROUPS.some((o) => o.match.includes(s.status)))).reduce((a, s) => a + s.count, 0),
  }));
  const total = groups.reduce((a, g) => a + g.count, 0);
  return (
    <DashCard title="Fleet status" action={<span className="text-sm text-muted-foreground">{total} active</span>}>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
        {groups.filter((g) => g.count).map((g) => (
          <div key={g.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", g.className)} style={{ width: `${(g.count / Math.max(total, 1)) * 100}%` }} title={`${g.label}: ${g.count}`} />
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {groups.map((g) => (
          <li key={g.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-sm", g.className)} />{g.label}</span>
            <span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{g.count}</span> · {total ? Math.round((g.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
      {d && d.fleetByStatus.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-3">
          {d.fleetByStatus.map((s) => (
            <Link key={s.status} href={`/admin/vehicles?status=${s.status}`}><Badge variant="muted" className="hover:bg-accent">{title(s.status)} · {s.count}</Badge></Link>
          ))}
        </div>
      )}
    </DashCard>
  );
}

export function Pipeline() {
  const p = useInsights()?.pipeline;
  const confirmedPct = p && p.next30 ? Math.round((p.confirmed / p.next30) * 100) : 0;
  return (
    <DashCard title="Booking pipeline" action={<Link href="/admin/reservations" className="text-sm text-primary hover:underline">Reservations</Link>}>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Pick-ups · 7 days", value: p?.next7, icon: CalendarClockIcon },
          { label: "Pick-ups · 30 days", value: p?.next30, icon: CarFrontIcon },
          { label: "Booked online", value: p?.online, icon: GlobeIcon },
          { label: "Quotes · 30 days", value: p?.quotes30, icon: ReceiptIcon },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><x.icon className="size-3.5" />{x.label}</div>
            <div className="mt-1 tracking-tight text-2xl font-bold tabular-nums">{x.value ?? "—"}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span>Confirmed</span><span className="tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{p?.confirmed ?? 0}</span> · {confirmedPct}%</span></div>
        <Meter percent={confirmedPct} />
        <div className="flex justify-between pt-1 text-muted-foreground"><span>Tentative</span><span className="tabular-nums">{p?.tentative ?? 0}</span></div>
      </div>
    </DashCard>
  );
}

export function ForecastChart() {
  const trpc = useTRPC();
  const [days, setDays] = React.useState<7 | 14 | 30>(14);
  const g = useQuery(trpc.staff.meta.dashboard.queryOptions({ days }, { placeholderData: (p) => p })).data?.graph;
  const peak = g?.reduce((a, x) => (x.percent > a.percent ? x : a), g[0]);
  return (
    <DashCard
      title="Utilization forecast"
      action={
        <div className="flex gap-1" role="group" aria-label="Period">
          {([[7, "7 Days"], [14, "14 Days"], [30, "1 Month"]] as const).map(([n, label]) => (
            <Button key={n} size="sm" variant={days === n ? "ink" : "outline"} onClick={() => setDays(n)} aria-pressed={days === n}>{label}</Button>
          ))}
        </div>
      }
    >
      {g ? (
        <Columns ariaLabel="Share of the fleet booked each day" format={(n) => `${Math.round(n)}%`} height={170} barClass="fill-success"
          data={g.map((x) => ({ label: day(x.date), sub: `${weekday(x.date)}, ${day(x.date)}`, value: x.percent, tip: `${x.percent}% booked · ${x.booked} vehicle${x.booked === 1 ? "" : "s"}` }))} />
      ) : <div className="h-40 animate-pulse rounded-md bg-muted" />}
      {peak && <p className="mt-1 text-xs text-muted-foreground">Busiest: {weekday(peak.date)} {day(peak.date)} at {peak.percent}% — rentals out plus reservations, of the active fleet.</p>}
    </DashCard>
  );
}

export function TypeTable() {
  const d = useInsights();
  const rows = d?.byType ?? [];
  return (
    <DashCard title="Vehicle types" action={<span className="text-sm text-muted-foreground">Utilization now · revenue MTD</span>}>
      {!rows.length ? <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">No vehicle types.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold text-muted-foreground">
              <tr><th className="pb-2 font-semibold">Type</th><th className="pb-2 text-right font-semibold">Fleet</th><th className="pb-2 text-right font-semibold">On rent</th><th className="w-[30%] pb-2 pl-4 font-semibold">Utilization</th><th className="pb-2 text-right font-semibold">Revenue</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 10).map((t) => {
                const u = t.fleet ? Math.round((t.onRent / t.fleet) * 100) : 0;
                return (
                  <tr key={t.name}>
                    <td className="py-2 font-medium">{t.name}</td>
                    <td className="py-2 text-right tabular-nums">{t.fleet}</td>
                    <td className="py-2 text-right tabular-nums">{t.onRent}</td>
                    <td className="py-2 pl-4"><div className="flex items-center gap-2"><div className="flex-1"><Meter percent={u} /></div><span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{u}%</span></div></td>
                    <td className="py-2 text-right tabular-nums">{money(t.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashCard>
  );
}

export function LocationsCard() {
  const d = useInsights();
  return (
    <DashCard title="Locations">
      <ul className="space-y-3 text-sm">
        {(d?.locations ?? []).map((l) => {
          const u = l.fleet ? Math.round((l.onRent / l.fleet) * 100) : 0;
          return (
            <li key={l.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium" title={l.name}>{l.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{l.onRent}/{l.fleet} out · {l.pickups7} pick-ups (7d)</span>
              </div>
              <Meter percent={u} className="bg-status-reservation" />
            </li>
          );
        })}
      </ul>
    </DashCard>
  );
}

export function RecentActivity() {
  const d = useInsights();
  return (
    <DashCard title="Latest bookings">
      {!d?.recent.length ? <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">No bookings yet.</p> : (
        <ol className="relative space-y-3 border-l pl-4 text-sm">
          {d.recent.map((r) => (
            <li key={`${r.kind}${r.id}`} className="relative">
              <span className={cn("absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full ring-2 ring-card", r.kind === "RENTAL" ? "bg-success" : "bg-status-reservation")} />
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <Link href={r.kind === "RENTAL" ? `/admin/rentals/${r.id}` : `/admin/reservations/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.kind === "RENTAL" ? `RA #${r.number}` : `Res #${r.number}`} · {r.name || "—"}
                </Link>
                <span className="text-xs text-muted-foreground">{day(r.at)} {new Date(r.at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {r.kind === "RENTAL" ? "Rental" : "Reservation"} · {r.detail} · {title(r.status)}
                {r.online && <Badge variant="muted" className="h-4 px-1.5 text-[10px]">Online</Badge>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashCard>
  );
}
