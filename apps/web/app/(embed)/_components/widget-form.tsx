"use client";

import * as React from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? "30" : "00";
  return { value: `${pad(h)}:${m}`, label: `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}` };
});
const field = "h-10 w-full rounded-control border bg-background px-3 text-sm";

/**
 * The booking widget (RentCentric WebCustomer/Widget.aspx): pick-up / return location, dates and times → the website's
 * vehicle results, opened in the Target chosen in Settings > Widget/Rotator Setup.
 */
export function WidgetForm({ locations, bookUrl, target }: { locations: { id: string; name: string }[]; bookUrl: string; target: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [same, setSame] = React.useState(true);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  React.useEffect(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const r = new Date(t);
    r.setDate(r.getDate() + 3);
    setFrom(day(t));
    setTo(day(r));
    setMounted(true);
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    const f = e.currentTarget;
    const fd = new FormData(f);
    const g = (k: string) => String(fd.get(k) ?? "");
    (f.elements.namedItem("from") as HTMLInputElement).value = `${g("fromDate")}T${g("fromTime")}`;
    (f.elements.namedItem("to") as HTMLInputElement).value = `${g("toDate")}T${g("toTime")}`;
  }

  return (
    <form action={bookUrl} method="get" target={target} onSubmit={submit} className="space-y-3 p-4">
      <h1 className="text-lg font-semibold">Book a car</h1>
      <label className="block space-y-1 text-sm font-medium">
        Pick-up location
        <select name="pickup" required className={field}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} className="size-4" /> Return to the same location</label>
      {!same && (
        <label className="block space-y-1 text-sm font-medium">
          Return location
          <select name="return" className={field}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        </label>
      )}
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="block space-y-1 text-sm font-medium">Pick-up date<input type="date" name="fromDate" required min={mounted ? day(new Date()) : undefined} value={from} onChange={(e) => setFrom(e.target.value)} className={field} /></label>
        <label className="block space-y-1 text-sm font-medium">Time<select name="fromTime" defaultValue="10:00" className={field}>{TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="block space-y-1 text-sm font-medium">Return date<input type="date" name="toDate" required min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} className={field} /></label>
        <label className="block space-y-1 text-sm font-medium">Time<select name="toTime" defaultValue="10:00" className={field}>{TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
      </div>
      <label className="block space-y-1 text-sm font-medium">Promo code (optional)<input name="promo" className={field} /></label>
      <input type="hidden" name="from" />
      <input type="hidden" name="to" />
      <button type="submit" className="h-11 w-full rounded-pill bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">Find a car</button>
    </form>
  );
}
