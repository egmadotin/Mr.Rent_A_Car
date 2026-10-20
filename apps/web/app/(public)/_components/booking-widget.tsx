"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, ClockIcon, MapPinIcon, SearchIcon, TagIcon } from "lucide-react";
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

/**
 * The one booking widget. Used on Home (hero), Fleet and Contact (panel), and the results page
 * ("Change booking info", compact). Replaces three separate copies on the current site.
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
  // "bar": the home page's one-line search bar; same fields as "compact", in a floating card
  const compact = variant === "compact" || variant === "bar";
  const field = "space-y-1.5";
  const label = cn("flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase", variant === "hero" ? "text-foreground/80" : "text-muted-foreground");

  return (
    <form
      onSubmit={submit}
      aria-label="Find a rental car"
      className={cn(
        "grid gap-4 text-card-foreground",
        variant === "hero" && "rounded-xl border bg-card/95 p-5 shadow-xl backdrop-blur md:p-6",
        variant === "panel" && "rounded-xl border bg-card p-5 shadow-sm",
        variant === "bar" && "rounded-2xl border bg-card p-4 shadow-[0_20px_50px_-20px_rgba(45,44,44,0.35)] md:p-5",
        compact ? "sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr_auto] lg:items-end" : "sm:grid-cols-2",
        className,
      )}
    >
      <div className={cn(field, !compact && "sm:col-span-2")}>
        <Label htmlFor="bw-pickup" className={label}><MapPinIcon className="size-3.5" /> Pick-up location</Label>
        <NativeSelect id="bw-pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} required>
          {!locations && <option value="">Loading…</option>}
          {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
        {!compact && (
          <label className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
            <input type="checkbox" className="accent-primary" checked={sameReturn} onChange={(e) => setSameReturn(e.target.checked)} />
            Return to the same location
          </label>
        )}
      </div>

      {!sameReturn && !compact && (
        <div className={cn(field, "sm:col-span-2")}>
          <Label htmlFor="bw-return" className={label}><MapPinIcon className="size-3.5" /> Return location</Label>
          <NativeSelect id="bw-return" value={ret || pickup} onChange={(e) => setRet(e.target.value)}>
            {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </div>
      )}

      <div className={field}>
        <Label htmlFor="bw-from" className={label}><CalendarIcon className="size-3.5" /> Pick-up date</Label>
        <Input id="bw-from" type="date" value={fromDate} min={today} onChange={(e) => setFromDate(e.target.value)} required />
      </div>
      <div className={field}>
        <Label htmlFor="bw-from-t" className={label}><ClockIcon className="size-3.5" /> Pick-up time</Label>
        <NativeSelect id="bw-from-t" value={fromTime} onChange={(e) => setFromTime(e.target.value)}>
          {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </NativeSelect>
      </div>
      <div className={field}>
        <Label htmlFor="bw-to" className={label}><CalendarIcon className="size-3.5" /> Return date</Label>
        <Input id="bw-to" type="date" value={toDate} min={fromDate || today} onChange={(e) => setToDate(e.target.value)} required />
      </div>
      <div className={field}>
        <Label htmlFor="bw-to-t" className={label}><ClockIcon className="size-3.5" /> Return time</Label>
        <NativeSelect id="bw-to-t" value={toTime} onChange={(e) => setToTime(e.target.value)}>
          {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </NativeSelect>
      </div>

      {!compact && (
        <div className={cn(field, "sm:col-span-2")}>
          <Label htmlFor="bw-promo" className={label}><TagIcon className="size-3.5" /> Promo code <span className="font-normal normal-case">(optional)</span></Label>
          <Input id="bw-promo" value={promo} onChange={(e) => setPromo(e.target.value)} autoComplete="off" />
        </div>
      )}

      {error && <p role="alert" className={cn("text-sm text-destructive", !compact && "sm:col-span-2")}>{error}</p>}

      <Button type="submit" size="lg" className={cn(!compact && "sm:col-span-2")}>
        <SearchIcon /> {variant === "compact" ? "Update" : "Find a car"}
      </Button>
    </form>
  );
}
