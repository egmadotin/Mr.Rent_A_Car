"use client";

import * as React from "react";
import { GripHorizontalIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import type { BookingOptions, BookingOptionsData } from "./options-grid";

/** Clicked / opened windows come to the front. */
let topZ = 40;

/**
 * A window that floats over the booking form without blocking it (client request — first for the Extras, then the
 * other "now and then" panels: more customer details, more trip details, payment). Drag it by the title bar, resize it
 * from the corner; it closes only with Done / × (not by clicking outside or Escape). It stays mounted while closed
 * (hidden), so what's inside keeps its state — the Extras grid keeps pre-ticking the defaults.
 * `size`: "lg" (the options list, right half of the screen) or "md" (a form panel, centred, as tall as its content).
 */
export function FloatingWindow({ open, onClose, title, children, size = "md" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "md" | "lg" }) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [z, setZ] = React.useState(topZ);
  const drag = React.useRef<{ dx: number; dy: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!open) return;
    setZ(++topZ);
    if (pos) return;
    const w = Math.min(size === "lg" ? 920 : 720, window.innerWidth - 32);
    setPos(size === "lg" ? { x: Math.max(16, window.innerWidth - w - 24), y: 72 } : { x: Math.max(16, (window.innerWidth - w) / 2), y: 96 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the title bar on screen when the browser window shrinks
  React.useEffect(() => {
    const keep = () =>
      setPos((p) => (p ? { x: Math.min(Math.max(0, p.x), window.innerWidth - 120), y: Math.min(Math.max(0, p.y), window.innerHeight - 48) } : p));
    window.addEventListener("resize", keep);
    return () => window.removeEventListener("resize", keep);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || !pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos({
      x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 48),
    });
  };
  const onPointerUp = () => (drag.current = null);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      hidden={!open}
      onPointerDownCapture={() => z !== topZ && setZ(++topZ)}
      style={{ zIndex: z, ...(pos ? { left: pos.x, top: pos.y } : {}) }}
      className={cn(
        "fixed min-h-48 min-w-80 resize flex-col overflow-hidden rounded-xl border bg-background shadow-2xl",
        size === "lg" ? "h-[min(78vh,760px)] w-[min(920px,calc(100vw-2rem))]" : "max-h-[85vh] w-[min(720px,calc(100vw-2rem))]",
        open ? "flex" : "hidden",
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex shrink-0 cursor-move items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 select-none touch-none"
      >
        <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold">
          <GripHorizontalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> {title}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">Drag to move · corner to resize</span>
          <Button type="button" size="sm" onClick={onClose}>Done</Button>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

/** The Extras list window (≈70 charges no longer take the booking screen). */
export function ExtrasWindow(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <FloatingWindow size="lg" {...props} />;
}

/** A one-line card on the form that opens a window: title, what's in it, and the button. */
export function WindowCard({ title, hint, summary, button, onOpen, className }: { title: string; hint?: string; summary?: React.ReactNode; button: React.ReactNode; onOpen: () => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2", className)}>
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold">{title} {hint && <span className="font-normal text-muted-foreground">— {hint}</span>}</p>
        {summary && <div className="truncate text-xs text-muted-foreground">{summary}</div>}
      </div>
      <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onOpen}>{button}</Button>
    </div>
  );
}

/** The Extras section on the form: what is chosen, and the button that opens the window. */
export function ExtrasSummary({ data, value, onOpen, className }: { data: BookingOptionsData | undefined; value: BookingOptions; onOpen: () => void; className?: string }) {
  const chosen: { key: string; label: string; rate: string }[] = [];
  if (data) {
    for (const i of data.insurances) if (value.insuranceIds.includes(i.id)) chosen.push({ key: `i${i.id}`, label: i.name, rate: money(i.dailyRate) });
    for (const c of value.miscCharges) {
      const m = data.misc.find((x) => x.id === c.miscChargeId);
      if (m) chosen.push({ key: `m${m.id}`, label: c.quantity > 1 ? `${m.name} × ${c.quantity}` : m.name, rate: m.calculationBy === "PERCENT" ? `${Number(m.rate)}%` : money(m.rate) });
    }
  }
  const exempt = data ? data.taxes.filter((t) => value.excludedTaxIds.includes(t.id)) : [];
  const other = value.otherCharges.length;
  return (
    <div className={cn("space-y-2 rounded-xl border bg-card p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold">{chosen.length} selected</span>
          {other > 0 && <span className="text-muted-foreground"> · {other} other charge{other > 1 ? "s" : ""}</span>}
        </p>
        <Button type="button" size="sm" onClick={onOpen} disabled={!data}>
          <SlidersHorizontalIcon /> Choose extras
        </Button>
      </div>
      {!data ? (
        <p className="text-sm text-muted-foreground">Choose a location, vehicle type and dates to see the extras.</p>
      ) : (
        <div className="flex max-h-[3.25rem] flex-wrap gap-1.5 overflow-hidden" title="Choose extras to see them all">
          {chosen.map((c) => (
            <button key={c.key} type="button" onClick={onOpen} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-left text-xs hover:bg-primary/15">
              {c.label} <span className="text-muted-foreground tabular-nums">{c.rate}</span>
            </button>
          ))}
          {exempt.map((t) => (
            <span key={t.id} className="rounded-full border border-warning/50 bg-warning/10 px-2.5 py-0.5 text-xs">No {t.name}</span>
          ))}
          {chosen.length === 0 && exempt.length === 0 && <span className="text-sm text-muted-foreground">No extras chosen.</span>}
        </div>
      )}
    </div>
  );
}
