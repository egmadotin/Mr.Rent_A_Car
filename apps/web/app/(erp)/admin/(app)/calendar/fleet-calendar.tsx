"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
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
  pickupLocation: string;
  returnLocation: string;
};

/** Legacy Visual Scheduler legend, same names. Colours are theme tokens. */
const KIND: Record<BarKind, { label: string; className: string }> = {
  UNASSIGNED: { label: "Unassigned reservation", className: "bg-status-unassigned text-black/80" },
  RESERVATION: { label: "Reservation", className: "bg-status-reservation text-white" },
  RENTAL: { label: "Agreement (rental)", className: "bg-status-rental text-white" },
  ONE_WAY: { label: "One way rental", className: "bg-status-oneway text-white" },
  OVERDUE: { label: "Overdue", className: "bg-status-overdue text-white" },
};

const LABEL_W = 224; // px, sticky vehicle column
const COL_W: Record<number, number> = { 7: 132, 14: 76, 30: 40 };
const DAY = 86_400_000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

/** Rendered in the browser only: "today" and day boundaries must use the viewer's time zone. */
export function FleetCalendar(props: { defaultLocationId?: string }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="p-6 text-sm text-muted-foreground">Loading calendar…</div>;
  return <FleetCalendarInner {...props} />;
}

function FleetCalendarInner({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const [start, setStart] = React.useState(() => startOfDay(new Date(Date.now() - DAY)));
  const [span, setSpan] = React.useState<7 | 14 | 30>(14);
  const [locationId, setLocationId] = React.useState<string>(defaultLocationId ?? "");
  const [vehicleTypeId, setVehicleTypeId] = React.useState("");
  const [dragging, setDragging] = React.useState<Bar | null>(null);
  const [dropTarget, setDropTarget] = React.useState<string | null>(null);

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

  // Group vehicle rows by type
  const groups = new Map<string, { name: string; rows: NonNullable<typeof data>["rows"] }>();
  for (const row of data?.rows ?? []) {
    const g = groups.get(row.vehicle.vehicleType.id) ?? { name: row.vehicle.vehicleType.name, rows: [] };
    g.rows.push(row);
    groups.set(row.vehicle.vehicleType.id, g);
  }
  const unassigned = packLanes((data?.unassigned ?? []) as (Bar & { vehicleTypeName: string })[]);
  const unassignedLanes = Math.max(1, ...unassigned.map((u) => u.lane + 1));
  const sameTypeVehicles = (typeId: string) => (data?.rows ?? []).filter((r) => r.vehicle.vehicleType.id === typeId).map((r) => r.vehicle);

  const DayStripes = ({ height }: { height?: number }) => (
    <>
      {days.map((d, i) =>
        d.getDay() === 0 || d.getDay() === 6 ? (
          <div key={i} aria-hidden className="absolute inset-y-0 bg-muted/60" style={{ left: i * col, width: col, height }} />
        ) : null,
      )}
    </>
  );

  const trackStyle: React.CSSProperties = {
    width: trackW,
    backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)",
    backgroundSize: `${col}px 100%`,
  };

  const renderBar = (bar: Bar, top = 4, height = 28) => {
    const left = Math.max(0, pct(bar.startsAt));
    const right = Math.min(100, pct(bar.endsAt));
    if (right <= 0 || left >= 100) return null;
    const clippedStart = pct(bar.startsAt) < 0;
    const clippedEnd = pct(bar.endsAt) > 100;
    const draggable = !!bar.reservationId;
    const candidates = bar.reservationId ? sameTypeVehicles(bar.vehicleTypeId) : [];
    return (
      <Popover key={bar.id}>
        <PopoverTrigger asChild>
          <button
            type="button"
            draggable={draggable}
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
              "absolute flex items-center overflow-hidden rounded px-1.5 text-left text-[11px] leading-tight font-medium whitespace-nowrap shadow-sm outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring",
              KIND[bar.kind].className,
              clippedStart && "rounded-l-none",
              clippedEnd && "rounded-r-none",
              draggable && "cursor-grab active:cursor-grabbing",
            )}
            style={{ left: `${left}%`, width: `calc(${right - left}% - 2px)`, top, height }}
            aria-label={`${KIND[bar.kind].label}: ${bar.label}, ${dateTime(bar.startsAt)} to ${dateTime(bar.endsAt)}`}
          >
            {clippedStart && "‹ "}
            <span className="truncate">{bar.label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="space-y-3 text-sm">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-sm", KIND[bar.kind].className)} /> {KIND[bar.kind].label}
            </div>
            <div className="mt-1 font-medium">{bar.label}</div>
          </div>
          <dl className="grid grid-cols-[4rem_1fr] gap-1 text-xs">
            <dt className="text-muted-foreground">Pickup</dt>
            <dd>{dateTime(bar.startsAt)} · {bar.pickupLocation}</dd>
            <dt className="text-muted-foreground">Return</dt>
            <dd>{dateTime(bar.endsAt)} · {bar.returnLocation}</dd>
          </dl>
          {bar.reservationId && candidates.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor={`assign-${bar.id}`} className="text-xs">Assign to vehicle (same type)</Label>
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
                  <option key={v.id} value={v.id}>{v.assignedId} — {v.title}</option>
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

  return (
    <div className="space-y-3 p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-end gap-1">
          <Button variant="outline" size="icon" aria-label="Earlier" onClick={() => setStart(new Date(+start - Math.ceil(span / 2) * DAY))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setStart(startOfDay(new Date(Date.now() - DAY)))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Later" onClick={() => setStart(new Date(+start + Math.ceil(span / 2) * DAY))}>
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-from" className="text-xs">From</Label>
          <Input id="cal-from" type="date" className="w-40" value={toDateInput(start)} onChange={(e) => e.target.value && setStart(startOfDay(new Date(`${e.target.value}T00:00`)))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-span" className="text-xs">Show</Label>
          <NativeSelect id="cal-span" className="w-28" value={span} onChange={(e) => setSpan(Number(e.target.value) as 7 | 14 | 30)}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-type" className="text-xs">Vehicle type</Label>
          <NativeSelect id="cal-type" className="w-52" value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)}>
            <option value="">All</option>
            {data?.vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cal-loc" className="text-xs">Location</Label>
          <NativeSelect id="cal-loc" className="w-60" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </div>
        <ul className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {Object.entries(KIND).map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-sm", v.className)} /> {v.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className={cn("max-h-[calc(100dvh-15rem)] overflow-auto rounded-lg border bg-card transition-opacity", isFetching && "opacity-70")}>
        <div className="relative" style={{ width: LABEL_W + trackW }}>
          {/* Header */}
          <div className="sticky top-0 z-20 flex border-b bg-card">
            <div className="sticky left-0 z-10 flex items-end border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground" style={{ width: LABEL_W }}>
              Vehicle
            </div>
            <div className="relative flex" style={{ width: trackW }}>
              {days.map((d, i) => {
                const today = +startOfDay(new Date()) === +d;
                return (
                  <div
                    key={i}
                    className={cn("border-l px-1 py-1.5 text-center text-[11px] leading-tight", (d.getDay() === 0 || d.getDay() === 6) && "bg-muted/60", today && "bg-primary/10 font-semibold text-primary")}
                    style={{ width: col }}
                  >
                    <div className="text-muted-foreground">{d.toLocaleDateString("en-CA", { weekday: span === 30 ? "narrow" : "short" })}</div>
                    <div>{span === 30 ? d.getDate() : d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today marker */}
          {todayPct > 0 && todayPct < 100 && (
            <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-destructive" style={{ left: LABEL_W + (todayPct / 100) * trackW }} />
          )}

          {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}

          {/* Unassigned reservations */}
          {unassigned.length > 0 && (
            <>
              <GroupHeader title="Unassigned reservations" count={unassigned.length} labelW={LABEL_W} trackW={trackW} />
              <div className="flex border-b">
                <div className="sticky left-0 z-10 border-r bg-card px-3 py-2 text-xs text-muted-foreground" style={{ width: LABEL_W }}>
                  Drag onto a vehicle to assign
                </div>
                <div className="relative" style={{ ...trackStyle, height: unassignedLanes * 34 + 6 }}>
                  <DayStripes />
                  {unassigned.map(({ item, lane }) => renderBar(item, 4 + lane * 34))}
                </div>
              </div>
            </>
          )}

          {/* Vehicles by type */}
          {[...groups.entries()].map(([typeId, g]) => (
            <React.Fragment key={typeId}>
              <GroupHeader title={g.name} count={g.rows.length} labelW={LABEL_W} trackW={trackW} />
              {g.rows.map((row) => {
                const accepts = dragging && dragging.vehicleTypeId === row.vehicle.vehicleType.id;
                return (
                  <div key={row.vehicle.id} className="flex border-b last:border-b-0">
                    <div className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r bg-card px-3" style={{ width: LABEL_W, height: 36 }}>
                      <Link href={`/admin/vehicles/${row.vehicle.id}`} className="truncate text-xs font-medium hover:underline">
                        {row.vehicle.assignedId} <span className="font-normal text-muted-foreground">{row.vehicle.title}</span>
                      </Link>
                      <span className="truncate text-[11px] text-muted-foreground">{row.vehicle.plate}</span>
                    </div>
                    <div
                      className={cn("relative transition-colors", accepts && "bg-primary/5", dropTarget === row.vehicle.id && accepts && "bg-primary/15 ring-2 ring-primary ring-inset")}
                      style={{ ...trackStyle, height: 36 }}
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
                      {row.bars.map((b) => renderBar(b as Bar))}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {!isLoading && groups.size === 0 && unassigned.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No vehicles for these filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ title, count, labelW, trackW }: { title: string; count: number; labelW: number; trackW: number }) {
  return (
    <div className="flex border-b bg-muted/50">
      <div className="sticky left-0 z-10 bg-muted px-3 py-1 text-xs font-semibold" style={{ width: labelW }}>
        {title} <span className="font-normal text-muted-foreground">({count})</span>
      </div>
      <div style={{ width: trackW }} />
    </div>
  );
}
