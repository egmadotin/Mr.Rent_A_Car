"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@mrac/ui/components/popover";
import { toast } from "@mrac/ui/components/sonner";
import { dateTime } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { errorMessage } from "../../../_components/form";

type BarKind = "UNASSIGNED" | "RESERVATION" | "RENTAL" | "ONE_WAY" | "OVERDUE";
type Bar = {
  id: string;
  kind: BarKind;
  startsAt: Date;
  endsAt: Date;
  label: string;
  href: string;
  reservationId: string | null;
  vehicleTypeId: string;
  vehicleTypeName?: string;
  pickupLocation: string;
  returnLocation: string;
};

/** Legacy Visual Scheduler legend, same names. Colours are theme tokens. */
const KIND: Record<BarKind, { label: string; className: string }> = {
  UNASSIGNED: { label: "Unassigned reservation", className: "bg-status-unassigned text-black/85" },
  RESERVATION: { label: "Reservation", className: "bg-status-reservation text-white" },
  RENTAL: { label: "Agreement (rental)", className: "bg-status-rental text-white" },
  ONE_WAY: { label: "One way rental", className: "bg-status-oneway text-white" },
  OVERDUE: { label: "Overdue", className: "bg-status-overdue text-white" },
};

/** A car in one of these can't be rented: shown as a badge beside it. */
const OFF_ROAD: Record<string, string> = {
  IN_REPAIR: "In repair", IN_SERVICE: "In service", OUT_OF_SERVICE: "Out of service", GROUNDED: "Grounded", HAS_PROBLEM: "Has problem",
  FOR_SALE: "For sale", HOLD_FOR_SALE: "Hold for sale", SOLD: "Sold", STOLEN: "Stolen", AUCTION: "Auction", STAFF: "Staff", COMPREHENSIVE: "Comprehensive",
  ACCIDENT_REPLACEMENT: "Accident repl.", LEASED_REPLACEMENT: "Leased repl.",
};

const LABEL_W = 272; // px, sticky vehicle column
const COL_W: Record<number, number> = { 7: 150, 14: 92, 30: 50 };
const ROW_H = 46;
const BAR_H = 34;
const HEAD_H = 50; // day header height: the unassigned row sticks right under it
const DAY = 86_400_000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDay = (d: Date) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

/** Greedy lane packing so overlapping unassigned reservations don't sit on top of each other. */
function packLanes<T extends { startsAt: Date; endsAt: Date }>(items: T[]) {
  const lanes: number[] = [];
  return items
    .slice()
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .map((item) => {
      const s = +new Date(item.startsAt);
      let lane = lanes.findIndex((end) => end <= s);
      if (lane === -1) lane = lanes.push(0) - 1;
      lanes[lane] = +new Date(item.endsAt);
      return { item, lane };
    });
}
const overlapsDay = (b: { startsAt: Date; endsAt: Date }, day: Date) => +new Date(b.startsAt) < +day + DAY && +new Date(b.endsAt) > +day;

/** Rendered in the browser only: "today" and day boundaries must use the viewer's time zone. */
export function FleetCalendar(props: { defaultLocationId?: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>;
  return <FleetCalendarInner {...props} />;
}

/**
 * Fleet calendar (client request, Nov 16: easier to read and use): larger text and bars, a vehicle search, each vehicle
 * type foldable with how many cars are free each day, today's column highlighted, off-road cars flagged, and a click on
 * an empty day starts a reservation for that car and date. Drag an unassigned reservation onto a car to assign it.
 */
function FleetCalendarInner({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const router = useRouter();
  const [start, setStart] = React.useState(() => startOfDay(new Date(Date.now() - DAY)));
  const [span, setSpan] = React.useState<7 | 14 | 30>(14);
  const [locationId, setLocationId] = React.useState<string>(defaultLocationId ?? "");
  const [vehicleTypeId, setVehicleTypeId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [dragging, setDragging] = React.useState<Bar | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState<{ vehicleId: string; day: number } | null>(null);

  // Columns stretch to fill the available width, never narrower than the minimum for the span.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = React.useState(0);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvailW(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const from = start;
  const to = new Date(+start + span * DAY);
  const col = Math.max(COL_W[span]!, Math.floor((availW - LABEL_W) / span));
  const trackW = span * col;

  const locations = useQuery(trpc.staff.meta.activeLocations.queryOptions()).data ?? [];
  const input = { from, to, locationId: locationId || undefined, vehicleTypeId: vehicleTypeId || undefined };
  const { data, isLoading, isFetching } = useQuery({ ...trpc.staff.calendar.range.queryOptions(input), placeholderData: keepPreviousData });

  const pct = (d: Date) => ((+new Date(d) - +from) / (+to - +from)) * 100;
  const days = Array.from({ length: span }, (_, i) => new Date(+from + i * DAY));
  const todayIdx = days.findIndex((d) => +d === +startOfDay(new Date()));
  const todayPct = pct(new Date());

  async function assign(bar: Bar, vehicleId: string, assignedId: string) {
    if (!bar.reservationId) return;
    try {
      await client.staff.calendar.assignReservation.mutate({ reservationId: bar.reservationId, vehicleId });
      toast.success(`${bar.label.split(" · ")[0]} assigned to ${assignedId}`);
      await qc.invalidateQueries({ queryKey: trpc.staff.calendar.range.queryKey() });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  // Vehicle rows by type, after the search
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups = new Map<string, { name: string; rows: NonNullable<typeof data>["rows"] }>();
  for (const row of data?.rows ?? []) {
    const hay = `${row.vehicle.assignedId} ${row.vehicle.title} ${row.vehicle.plate ?? ""} ${row.vehicle.vehicleType.name}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const g = groups.get(row.vehicle.vehicleType.id) ?? { name: row.vehicle.vehicleType.name, rows: [] };
    g.rows.push(row);
    groups.set(row.vehicle.vehicleType.id, g);
  }
  const unassignedAll = (data?.unassigned ?? []) as (Bar & { vehicleTypeName: string })[];
  const unassigned = packLanes(unassignedAll);
  const unassignedLanes = Math.max(1, ...unassigned.map((u) => u.lane + 1));
  const sameTypeVehicles = (typeId: string) => (data?.rows ?? []).filter((r) => r.vehicle.vehicleType.id === typeId).map((r) => r.vehicle);

  // free cars of a type per day: rentable cars with nothing on that day, minus that day's unassigned reservations
  const freeByDay = (typeId: string) => {
    const rows = (data?.rows ?? []).filter((r) => r.vehicle.vehicleType.id === typeId && !OFF_ROAD[r.vehicle.status]);
    return days.map((d) => {
      const busy = rows.filter((r) => r.bars.some((b) => overlapsDay(b as Bar, d))).length;
      const waiting = unassignedAll.filter((u) => u.vehicleTypeId === typeId && overlapsDay(u, d)).length;
      return { free: rows.length - busy - waiting, total: rows.length };
    });
  };

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const DayStripes = () => (
    <>
      {days.map((d, i) =>
        d.getDay() === 0 || d.getDay() === 6 || i === todayIdx ? (
          <div key={i} aria-hidden className={cn("absolute inset-y-0", i === todayIdx ? "bg-primary/10" : "bg-muted/50")} style={{ left: i * col, width: col }} />
        ) : null,
      )}
    </>
  );

  const trackStyle: React.CSSProperties = {
    width: trackW,
    backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)",
    backgroundSize: `${col}px 100%`,
  };

  const renderBar = (bar: Bar, top = (ROW_H - BAR_H) / 2, height = BAR_H) => {
    const left = Math.max(0, pct(bar.startsAt));
    const right = Math.min(100, pct(bar.endsAt));
    if (right <= 0 || left >= 100) return null;
    const clippedStart = pct(bar.startsAt) < 0;
    const clippedEnd = pct(bar.endsAt) > 100;
    const draggable = !!bar.reservationId;
    const candidates = bar.reservationId ? sameTypeVehicles(bar.vehicleTypeId) : [];
    const widthPx = ((right - left) / 100) * trackW;
    const tip = `${KIND[bar.kind].label}: ${bar.label}\nPickup ${dateTime(bar.startsAt)} · ${bar.pickupLocation}\nReturn ${dateTime(bar.endsAt)} · ${bar.returnLocation}`;
    return (
      <Popover key={bar.id}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={tip}
            draggable={draggable}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", bar.id);
              e.dataTransfer.effectAllowed = "move";
              setDragging(bar);
            }}
            onDragEnd={() => {
              setDragging(null);
              setDropTarget(null);
            }}
            className={cn(
              "absolute z-[1] flex items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[0.8125rem] leading-tight font-semibold whitespace-nowrap shadow-sm outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring",
              KIND[bar.kind].className,
              clippedStart && "rounded-l-none",
              clippedEnd && "rounded-r-none",
              draggable && "cursor-grab active:cursor-grabbing",
            )}
            style={{ left: `${left}%`, width: `calc(${right - left}% - 2px)`, top, height }}
            aria-label={`${KIND[bar.kind].label}: ${bar.label}, ${dateTime(bar.startsAt)} to ${dateTime(bar.endsAt)}`}
          >
            {clippedStart && "‹"}
            <span className="truncate">{bar.label}</span>
            {bar.kind === "UNASSIGNED" && bar.vehicleTypeName && <span className="shrink-0 rounded bg-black/10 px-1.5 text-xs font-medium">{bar.vehicleTypeName}</span>}
            {widthPx > 230 && <span className="ml-auto shrink-0 text-xs font-normal opacity-90">→ {shortDay(bar.endsAt)}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="space-y-3 text-sm">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-sm", KIND[bar.kind].className)} /> {KIND[bar.kind].label}
            </div>
            <div className="mt-1 text-base font-semibold">{bar.label}</div>
          </div>
          <dl className="grid grid-cols-[4rem_1fr] gap-1.5 text-sm">
            <dt className="text-muted-foreground">Pickup</dt>
            <dd>{dateTime(bar.startsAt)} · {bar.pickupLocation}</dd>
            <dt className="text-muted-foreground">Return</dt>
            <dd>{dateTime(bar.endsAt)} · {bar.returnLocation}</dd>
          </dl>
          {bar.reservationId && candidates.length === 0 && (
            <p className="rounded-md bg-warning/10 p-2 text-xs">
              No {bar.vehicleTypeName ?? "cars of this type"} {bar.vehicleTypeName ? "cars " : ""}in this view. Choose All locations, or change the reservation&apos;s vehicle type to one the fleet has.
            </p>
          )}
          {bar.reservationId && candidates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`assign-${bar.id}`}>Assign to vehicle (same type)</Label>
              <NativeSelect
                id={`assign-${bar.id}`}
                defaultValue=""
                onChange={(e) => {
                  const v = candidates.find((c) => c.id === e.target.value);
                  if (v) assign(bar, v.id, v.assignedId);
                }}
              >
                <option value="" disabled>Choose…</option>
                {candidates.map((v) => (
                  <option key={v.id} value={v.id}>{v.assignedId} — {v.title}{v.home ? ` (${v.home.label})` : ""}</option>
                ))}
              </NativeSelect>
            </div>
          )}
          <Button asChild size="sm" className="w-full">
            <Link href={bar.href}>
              Open <ExternalLinkIcon />
            </Link>
          </Button>
        </PopoverContent>
      </Popover>
    );
  };

  const typeIds = [...groups.keys()];
  const allCollapsed = typeIds.length > 0 && typeIds.every((id) => collapsed.has(id));

  return (
    <div className="space-y-3 p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-1">
          <Button variant="outline" size="icon" aria-label="Earlier" title="Earlier" onClick={() => setStart(new Date(+start - Math.ceil(span / 2) * DAY))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setStart(startOfDay(new Date(Date.now() - DAY)))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Later" title="Later" onClick={() => setStart(new Date(+start + Math.ceil(span / 2) * DAY))}>
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-from">From</Label>
          <Input id="cal-from" type="date" className="w-40" value={toDateInput(start)} onChange={(e) => e.target.value && setStart(startOfDay(new Date(`${e.target.value}T00:00`)))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-span">Show</Label>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Days shown">
            {([7, 14, 30] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={span === n}
                onClick={() => setSpan(n)}
                className={cn("rounded px-3 py-1 text-sm font-medium", span === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {n} days
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-type">Vehicle type</Label>
          <NativeSelect id="cal-type" className="w-52" value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)}>
            <option value="">All</option>
            {data?.vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-loc">Location</Label>
          <NativeSelect id="cal-loc" className="w-60" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-search">Find vehicle</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="cal-search" className="w-56 pl-8" placeholder="Unit #, make, model, plate" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(typeIds))}>
          {allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
          {Object.entries(KIND).map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("size-3.5 rounded", v.className)} /> {v.label}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Click a booking for details · drag a yellow one onto a car to assign it · click an empty day to reserve that car</p>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className={cn("max-h-[calc(100dvh-17rem)] overflow-auto rounded-lg border bg-card transition-opacity", isFetching && "opacity-70")}>
        <div className="relative" style={{ width: LABEL_W + trackW }}>
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b bg-card" style={{ height: HEAD_H }}>
            <div className="sticky left-0 z-10 flex items-end border-r bg-card px-3 py-2 text-sm font-semibold" style={{ width: LABEL_W }}>
              Vehicle
            </div>
            <div className="relative flex" style={{ width: trackW }}>
              {days.map((d, i) => {
                const today = i === todayIdx;
                return (
                  <div
                    key={i}
                    className={cn(
                      "border-l px-1 py-1.5 text-center leading-tight",
                      (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/60",
                      today && "bg-primary text-primary-foreground",
                    )}
                    style={{ width: col }}
                  >
                    <div className={cn("text-xs", today ? "font-semibold" : "text-muted-foreground")}>{today ? "Today" : d.toLocaleDateString("en-CA", { weekday: span === 30 ? "narrow" : "short" })}</div>
                    <div className="text-sm font-semibold">{span === 30 ? d.getDate() : shortDay(d)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Now marker */}
          {todayPct > 0 && todayPct < 100 && (
            <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-destructive" style={{ left: LABEL_W + (todayPct / 100) * trackW }} />
          )}

          {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}

          {/* Unassigned reservations */}
          {unassigned.length > 0 && (
            // pinned under the dates, so a reservation can be dragged onto any car further down
            <div className="sticky z-[15] max-h-[40vh] overflow-y-auto border-b-2 border-status-unassigned bg-card shadow-md" style={{ top: HEAD_H }}>
              <GroupHeader title="Unassigned reservations" count={unassigned.length} labelW={LABEL_W} trackW={trackW} highlight />
              <div className="flex border-b">
                <div className="sticky left-0 z-10 flex items-center border-r bg-card px-3 text-sm text-muted-foreground" style={{ width: LABEL_W }}>
                  Drag onto a car of the same type (or click it) to assign
                </div>
                <div className="relative" style={{ ...trackStyle, height: unassignedLanes * (BAR_H + 6) + 8 }}>
                  <DayStripes />
                  {unassigned.map(({ item, lane }) => renderBar(item, 6 + lane * (BAR_H + 6)))}
                </div>
              </div>
            </div>
          )}

          {/* Vehicles by type */}
          {[...groups.entries()].map(([typeId, g]) => {
            const open = !collapsed.has(typeId);
            const free = freeByDay(typeId);
            return (
              <React.Fragment key={typeId}>
                <div className="flex border-b bg-muted/60">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(typeId)}
                    className="sticky left-0 z-10 flex items-center gap-2 border-r bg-muted px-3 py-1.5 text-left text-sm font-semibold hover:bg-accent"
                    style={{ width: LABEL_W }}
                  >
                    <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", !open && "-rotate-90")} />
                    <span className="truncate">{g.name}</span>
                    <span className="font-normal text-muted-foreground">({g.rows.length})</span>
                  </button>
                  {/* cars free per day */}
                  <div className="flex" style={{ width: trackW }}>
                    {free.map((f, i) => (
                      <div
                        key={i}
                        title={`${g.name}, ${shortDay(days[i]!)}: ${f.free} of ${f.total} free`}
                        className={cn(
                          "flex items-center justify-center border-l text-xs font-semibold tabular-nums",
                          f.total === 0 ? "text-muted-foreground" : f.free <= 0 ? "text-destructive" : f.free === 1 ? "text-warning" : "text-success",
                          i === todayIdx && "bg-primary/10",
                        )}
                        style={{ width: col }}
                      >
                        {span === 30 ? Math.max(f.free, 0) : f.free < 0 ? `${f.free} over` : `${f.free} free`}
                      </div>
                    ))}
                  </div>
                </div>
                {open &&
                  g.rows.map((row) => {
                    const accepts = dragging && dragging.vehicleTypeId === row.vehicle.vehicleType.id;
                    const off = OFF_ROAD[row.vehicle.status];
                    return (
                      <div key={row.vehicle.id} className="flex border-b last:border-b-0">
                        <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r bg-card px-3" style={{ width: LABEL_W, height: ROW_H }}>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Link href={`/admin/vehicles/${row.vehicle.id}`} className="shrink-0 text-sm font-semibold hover:underline">
                              {row.vehicle.assignedId}
                            </Link>
                            <span className="truncate text-sm text-muted-foreground">{row.vehicle.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate">{row.vehicle.plate}</span>
                            {off && <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-px font-medium text-destructive">{off}</span>}
                            {locationId && row.vehicle.home && row.vehicle.home.id !== locationId && (
                              <span className="shrink-0 rounded bg-info/15 px-1.5 py-px font-medium text-info" title="This car belongs to another location and has a booking here">from {row.vehicle.home.label}</span>
                            )}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "relative cursor-pointer transition-colors",
                            off && "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--muted)_6px,var(--muted)_8px)]",
                            accepts && "bg-primary/5",
                            dropTarget === row.vehicle.id && accepts && "bg-primary/15 ring-2 ring-primary ring-inset",
                          )}
                          style={{ ...trackStyle, height: ROW_H }}
                          onMouseMove={(e) => {
                            const day = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / col);
                            if (hover?.vehicleId !== row.vehicle.id || hover.day !== day) setHover({ vehicleId: row.vehicle.id, day });
                          }}
                          onMouseLeave={() => setHover(null)}
                          onClick={(e) => {
                            // an empty day: reserve this car from that day
                            const day = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / col);
                            const d = days[day];
                            if (!d || row.bars.some((b) => overlapsDay(b as Bar, d))) return;
                            router.push(`/admin/reservations/new?vehicleId=${row.vehicle.id}&on=${toDateInput(d)}`);
                          }}
                          onDragOver={(e) => {
                            if (!accepts) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDropTarget(row.vehicle.id);
                          }}
                          onDragLeave={() => setDropTarget((t) => (t === row.vehicle.id ? null : t))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const bar = dragging;
                            setDragging(null);
                            setDropTarget(null);
                            if (bar && accepts) assign(bar, row.vehicle.id, row.vehicle.assignedId);
                          }}
                        >
                          <DayStripes />
                          {hover?.vehicleId === row.vehicle.id && days[hover.day] && !row.bars.some((b) => overlapsDay(b as Bar, days[hover.day]!)) && !dragging && (
                            <div
                              aria-hidden
                              className="pointer-events-none absolute inset-y-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-primary/60 bg-primary/5 text-xs font-medium text-primary"
                              style={{ left: hover.day * col + 2, width: col - 4 }}
                            >
                              <PlusIcon className="size-3.5" />
                              {col >= 80 && "Reserve"}
                            </div>
                          )}
                          {row.bars.map((b) => renderBar(b as Bar))}
                        </div>
                      </div>
                    );
                  })}
              </React.Fragment>
            );
          })}

          {!isLoading && groups.size === 0 && unassigned.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">{search ? `No vehicle matches “${search}”.` : "No vehicles for these filters."}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ title, count, labelW, trackW, highlight }: { title: string; count: number; labelW: number; trackW: number; highlight?: boolean }) {
  return (
    <div className={cn("flex border-b", highlight ? "bg-status-unassigned/20" : "bg-muted/50")}>
      <div className={cn("sticky left-0 z-10 px-3 py-1.5 text-sm font-semibold", highlight ? "bg-status-unassigned/30" : "bg-muted")} style={{ width: labelW }}>
        {title} <span className="font-normal text-muted-foreground">({count})</span>
      </div>
      <div style={{ width: trackW }} />
    </div>
  );
}
