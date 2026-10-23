"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, ChevronDownIcon, MapPinIcon, SearchIcon, TagIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { cn } from "@mrac/ui/lib/utils";

/** Search state carried in the URL: ?pickup=&return=&from=YYYY-MM-DDTHH:mm&to=…&promo= (viewer-local times). */
export type BookingSearch = { pickup?: string; return?: string; from?: string; to?: string; promo?: string };

const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  const label = `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function toQuery(s: BookingSearch) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) if (v) q.set(k, v);
  return q.toString();
}

/** A borderless control that lives inside a booking-capsule cell. */
const bare =
  "w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[15px] font-semibold text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-60";

/**
 * The one booking widget — the booking capsule. Used on Home ("bar": pill capsule on desktop, booking sheet on
 * mobile), Fleet and Contact ("panel"), and the results page ("compact", Change booking info).
 */
export function BookingWidget({
  variant = "panel",
  initial,
  className,
}: {
  variant?: "hero" | "panel" | "compact" | "bar";
  initial?: BookingSearch;
  className?: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: locations } = useQuery(trpc.customer.locations.queryOptions());

  const [mounted, setMounted] = React.useState(false);
  const [pickup, setPickup] = React.useState(initial?.pickup ?? "");
  const [ret, setRet] = React.useState(initial?.return ?? "");
  const [sameReturn, setSameReturn] = React.useState(!initial?.return || initial.return === initial.pickup);
  const [fromDate, setFromDate] = React.useState(initial?.from?.slice(0, 10) ?? "");
  const [fromTime, setFromTime] = React.useState(initial?.from?.slice(11, 16) ?? "10:00");
  const [toDate, setToDate] = React.useState(initial?.to?.slice(0, 10) ?? "");
  const [toTime, setToTime] = React.useState(initial?.to?.slice(11, 16) ?? "10:00");
  const [promo, setPromo] = React.useState(initial?.promo ?? "");
  const [showPromo, setShowPromo] = React.useState(!!initial?.promo);
  const [error, setError] = React.useState<string | null>(null);

  // Default dates in the browser (viewer's time zone): tomorrow → +3 days.
  React.useEffect(() => {
    setMounted(true);
    const t = new Date(Date.now() + 86_400_000);
    setFromDate((d) => d || localDate(t));
    setToDate((d) => d || localDate(new Date(+t + 3 * 86_400_000)));
  }, []);
  React.useEffect(() => {
    if (!pickup && locations?.[0]) setPickup(locations[0].id);
  }, [locations, pickup]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const from = `${fromDate}T${fromTime}`;
    const to = `${toDate}T${toTime}`;
    if (!pickup) return setError("Choose a pick-up location.");
    if (new Date(to) <= new Date(from)) return setError("Return must be after pick-up.");
    if (new Date(from) < new Date(Date.now() - 3_600_000)) return setError("Pick-up can't be in the past.");
    setError(null);
    router.push(`/book?${toQuery({ pickup, return: sameReturn ? pickup : ret || pickup, from, to, promo })}`);
  }

  const today = mounted ? localDate(new Date()) : undefined;
  const locationOptions = (
    <>
      {!locations && <option value="">Loading…</option>}
      {locations?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </>
  );

  /* ── Capsule (home bar + results "compact") ───────────────────────────── */
  if (variant === "bar" || variant === "compact") {
    const capsule = variant === "bar";
    return (
      <form onSubmit={submit} aria-label="Find a rental car" className={cn("text-card-foreground", className)}>
        <div
          className={cn(
            "grid border bg-card",
            capsule
              ? "rounded-sheet p-2 shadow-booking lg:rounded-pill lg:p-1.5"
              : "rounded-card p-1.5",
            sameReturn
              ? "lg:grid-cols-[1.25fr_1fr_1fr_auto]"
              : "lg:grid-cols-[1.1fr_1.1fr_1fr_1fr_auto]",
          )}
        >
          <Cell id="bw-pickup" label="Pick-up" icon={MapPinIcon} first>
            <select id="bw-pickup" className={bare} value={pickup} onChange={(e) => setPickup(e.target.value)} required>
              {locationOptions}
            </select>
          </Cell>
          {!sameReturn && (
            <Cell id="bw-return" label="Return" icon={MapPinIcon}>
              <select id="bw-return" className={bare} value={ret || pickup} onChange={(e) => setRet(e.target.value)}>
                {locationOptions}
              </select>
            </Cell>
          )}
          <Cell id="bw-from" label="Pick-up date" icon={CalendarIcon}>
            <div className="flex items-center gap-2">
              <input id="bw-from" type="date" className={cn(bare, "flex-1")} value={fromDate} min={today} onChange={(e) => setFromDate(e.target.value)} required />
              <select aria-label="Pick-up time" className={cn(bare, "w-auto text-muted-foreground")} value={fromTime} onChange={(e) => setFromTime(e.target.value)}>
                {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </Cell>
          <Cell id="bw-to" label="Return date" icon={CalendarIcon}>
            <div className="flex items-center gap-2">
              <input id="bw-to" type="date" className={cn(bare, "flex-1")} value={toDate} min={fromDate || today} onChange={(e) => setToDate(e.target.value)} required />
              <select aria-label="Return time" className={cn(bare, "w-auto text-muted-foreground")} value={toTime} onChange={(e) => setToTime(e.target.value)}>
                {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </Cell>
          <div className="p-1 lg:pl-1.5">
            <Button type="submit" size="lg" className={cn("h-14 w-full px-7 text-base", capsule && "lg:rounded-pill")}>
              <SearchIcon className="size-[18px]" /> {variant === "compact" ? "Update" : "Find a car"}
            </Button>
          </div>
        </div>

        <div className={cn("mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm", capsule && "px-4")}>
          <label className="flex cursor-pointer items-center gap-2 font-medium">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!sameReturn} onChange={(e) => setSameReturn(!e.target.checked)} />
            Return to a different location
          </label>
          {showPromo ? (
            <span className="flex items-center gap-2">
              <TagIcon className="size-4 text-muted-foreground" />
              <input
                aria-label="Promo code"
                placeholder="Promo code"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                autoComplete="off"
                className="h-8 w-36 rounded-pill border border-input bg-card px-3 text-sm font-medium uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </span>
          ) : (
            <button type="button" onClick={() => setShowPromo(true)} className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground">
              <TagIcon className="size-4" /> Add a promo code
            </button>
          )}
          {error && <p role="alert" className="font-semibold text-brand">{error}</p>}
        </div>
      </form>
    );
  }

  /* ── Panel (Fleet, Contact): stacked fields on a card ─────────────────── */
  const label = "text-[13px] font-semibold text-muted-foreground";
  return (
    <form
      onSubmit={submit}
      aria-label="Find a rental car"
      className={cn(
        "grid gap-4 text-card-foreground sm:grid-cols-2",
        variant === "hero" && "rounded-card border bg-card p-5 shadow-booking md:p-6",
        variant === "panel" && "rounded-card border bg-card p-5",
        className,
      )}
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="bw-pickup" className={label}>Pick-up location</Label>
        <NativeSelect id="bw-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} required>
          {locationOptions}
        </NativeSelect>
        <label className="flex cursor-pointer items-center gap-2 pt-1.5 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!sameReturn} onChange={(e) => setSameReturn(!e.target.checked)} />
          Return to a different location
        </label>
      </div>

      {!sameReturn && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bw-return" className={label}>Return location</Label>
          <NativeSelect id="bw-return" value={ret || pickup} onChange={(e) => setRet(e.target.value)}>
            {locationOptions}
          </NativeSelect>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bw-from" className={label}>Pick-up date</Label>
        <Input id="bw-from" type="date" value={fromDate} min={today} onChange={(e) => setFromDate(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bw-from-t" className={label}>Time</Label>
        <NativeSelect id="bw-from-t" value={fromTime} onChange={(e) => setFromTime(e.target.value)}>
          {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bw-to" className={label}>Return date</Label>
        <Input id="bw-to" type="date" value={toDate} min={fromDate || today} onChange={(e) => setToDate(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bw-to-t" className={label}>Time</Label>
        <NativeSelect id="bw-to-t" value={toTime} onChange={(e) => setToTime(e.target.value)}>
          {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </NativeSelect>
      </div>

      {showPromo ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bw-promo" className={label}>Promo code</Label>
          <Input id="bw-promo" value={promo} onChange={(e) => setPromo(e.target.value)} autoComplete="off" className="uppercase" />
        </div>
      ) : (
        <button type="button" onClick={() => setShowPromo(true)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:col-span-2">
          <TagIcon className="size-4" /> Add a promo code
        </button>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-brand sm:col-span-2">{error}</p>}

      <Button type="submit" size="lg" className="sm:col-span-2">
        <SearchIcon /> Find a car
      </Button>
    </form>
  );
}

/** One cell of the booking capsule: small label over a bare control; the focused cell gets the 2px ring. */
function Cell({
  id,
  label,
  icon: Icon,
  first,
  children,
}: {
  id: string;
  label: string;
  icon: typeof MapPinIcon;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-center gap-3 rounded-[calc(var(--radius-sheet-size)-8px)] px-4 py-3 transition-colors hover:bg-muted focus-within:bg-card focus-within:ring-2 focus-within:ring-ring lg:rounded-pill lg:px-5",
        !first && "before:absolute before:top-3 before:bottom-3 before:-left-px before:hidden before:w-px before:bg-border lg:before:block",
        "border-b last:border-b-0 lg:border-b-0",
      )}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">
          {label}
        </label>
        <div className="relative">{children}</div>
      </div>
      {id === "bw-pickup" || id === "bw-return" ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}
