"use client";

import * as React from "react";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { FloatingWindow, WindowCard } from "./extras-window";

/**
 * Booking forms on ONE page (client request): Customer, Trip & vehicle, Extras, Summary & payment, no Back / Next.
 * - wide screens (2xl, 1536px+): the "cockpit" — the sections side by side in columns that fill the window under the
 *   page header, tighter controls (`.booking-cockpit` in globals.css), Save pinned at the bottom of the last column; a
 *   column scrolls on its own only if its content can't fit
 * - smaller screens: the sections stacked, a sticky bar on top to jump between them with the booking at a glance
 */
export type Step = { key: string; label: string; hint?: string };

export const stepId = (key: string) => `step-${key}`;

/** Scroll a section into view (used by the jump bar and to show the first field with an error). */
export function scrollToStep(key: string) {
  document.getElementById(stepId(key))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Enter in a text field must not submit the whole booking (the save button does). */
export function blockEnterSubmit(e: React.KeyboardEvent<HTMLFormElement>) {
  const t = e.target as HTMLElement;
  if (e.key === "Enter" && t instanceof HTMLInputElement && t.type !== "submit" && t.type !== "button") e.preventDefault();
}

/** Wide screens: a row of columns that fills the window under the page header (the page itself doesn't scroll). */
export function CockpitGrid({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // re-measured on every render (an error alert above can push it down) and on resize
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 96rem)");
    const fit = () => {
      if (!mq.matches) return void (el.style.height = "");
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = `${Math.max(520, window.innerHeight - top - 16)}px`;
      if (el.style.height !== h) el.style.height = h;
    };
    fit();
    window.addEventListener("resize", fit);
    mq.addEventListener("change", fit);
    return () => {
      window.removeEventListener("resize", fit);
      mq.removeEventListener("change", fit);
    };
  });
  return <div ref={ref} className={cn("flex flex-col gap-6 2xl:grid 2xl:grid-rows-[minmax(0,1fr)] 2xl:gap-4", className)}>{children}</div>;
}

/**
 * One column of the cockpit; scrolls on its own only when its content is taller than the window. On smaller screens it
 * is `display: contents`, so its sections stack in the page (and `max-2xl:order-*` can reorder them).
 */
export function CockpitCol({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("contents 2xl:flex 2xl:min-h-0 2xl:flex-col 2xl:gap-3 2xl:overflow-y-auto 2xl:pr-1", className)}>{children}</div>;
}

/** Sticky top (smaller screens): section links (highlighting the one in view) above the booking summary. */
export function BookingTopBar({ steps, children }: { steps: Step[]; children?: React.ReactNode }) {
  const [active, setActive] = React.useState(steps[0]?.key);
  React.useEffect(() => {
    const els = steps.map((s) => document.getElementById(stepId(s.key))).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace(/^step-/, ""));
      },
      { rootMargin: "-160px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [steps]);

  return (
    <div className="z-20 -mx-4 space-y-2 border-b 2xl:hidden bg-background/95 px-4 pb-2 pt-1 backdrop-blur sm:sticky sm:top-0 md:-mx-6 md:px-6">
      <nav aria-label="Booking sections" className="overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1">
          {steps.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => scrollToStep(s.key)}
                aria-current={active === s.key ? "location" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                  active === s.key ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                    active === s.key && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {i + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {children}
    </div>
  );
}

/** A section's numbered heading; `actions` sit at its right end (e.g. Check Matching). */
export function StepHeading({ step, n, actions }: { step: Step; n: number; actions?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <h2 id={`${stepId(step.key)}-h`} className="flex min-w-0 items-baseline gap-2 text-base font-semibold">
        <span className="flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums 2xl:size-5">{n}</span>
        <span className="shrink-0">{step.label}</span>
        {step.hint && <span className="truncate text-sm font-normal text-muted-foreground">— {step.hint}</span>}
      </h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** One section of the page, with its numbered heading (`bare`: the content renders the heading itself). */
export function StepPanel({ step, n, children, className, actions, bare }: { step: Step; n: number; children: React.ReactNode; className?: string; actions?: React.ReactNode; bare?: boolean }) {
  return (
    <section id={stepId(step.key)} aria-labelledby={`${stepId(step.key)}-h`} className={cn("scroll-mt-36 space-y-4 pt-2 2xl:shrink-0 2xl:space-y-2 2xl:pt-0", className)}>
      {!bare && <StepHeading step={step} n={n} actions={actions} />}
      {children}
    </section>
  );
}

/**
 * The fields used now and then (insurance, notes, flight …): a one-line card on the form that opens them in a movable
 * window (client request: opened inline they pushed the columns past the bottom of the screen).
 */
export function MoreFold({ title, hint, summary, children, className }: { title: string; hint?: string; summary?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <WindowCard className={className} title={title} hint={hint} summary={summary} button="Open" onOpen={() => setOpen(true)} />
      <FloatingWindow open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-4">{children}</div>
      </FloatingWindow>
    </>
  );
}

/** The save bar at the bottom of the page (wide screens: at the bottom of the last column). */
export function StepNav({ next, children, className }: { next?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 2xl:static 2xl:mx-0 2xl:shrink-0 2xl:bg-transparent 2xl:px-0 2xl:pb-0 2xl:backdrop-blur-none", className)}>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {next}
    </div>
  );
}

/** The booking at a glance: customer, dates, vehicle, total. */
export function BookingSummaryBar({ customer, from, to, vehicle, total, days }: { customer: string; from?: string; to?: string; vehicle?: string; total?: number | null; days?: number | string }) {
  const item = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 px-4 py-2 sm:grid-cols-5">
      {item("Customer", customer)}
      {item("Pick-up", from)}
      {item("Return", to)}
      {item("Vehicle", vehicle && `${vehicle}${days ? ` · ${days} day${Number(days) === 1 ? "" : "s"}` : ""}`)}
      {item("Estimated total", total != null ? money(total) : "")}
    </div>
  );
}

/** "2026-11-03T09:00" → "Nov 3, 9:00 AM" for the summary bar. */
export const shortWhen = (s: string) => {
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(+d) ? d.toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};
