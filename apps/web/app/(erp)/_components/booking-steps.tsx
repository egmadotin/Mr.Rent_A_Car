"use client";

import * as React from "react";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";

/**
 * Booking forms on ONE page (client request): Customer, Trip & vehicle, Extras, Summary & payment are stacked sections,
 * no Back / Next. A sticky bar on top jumps to a section and keeps the booking at a glance (customer, dates, vehicle,
 * total) in view; one action bar at the bottom saves.
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

/** Sticky top: section links (highlighting the one in view) above the booking summary. */
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
    <div className="z-20 -mx-4 space-y-2 border-b bg-background/95 px-4 pb-2 pt-1 backdrop-blur sm:sticky sm:top-0 md:-mx-6 md:px-6">
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

/** One section of the page, with its numbered heading. */
export function StepPanel({ step, n, children, className }: { step: Step; n: number; children: React.ReactNode; className?: string }) {
  return (
    <section id={stepId(step.key)} aria-labelledby={`${stepId(step.key)}-h`} className={cn("scroll-mt-36 space-y-4 pt-2", className)}>
      <h2 id={`${stepId(step.key)}-h`} className="flex items-baseline gap-2 text-base font-semibold">
        <span className="flex size-6 shrink-0 items-center justify-center self-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums">{n}</span>
        {step.label}
        {step.hint && <span className="text-sm font-normal text-muted-foreground">— {step.hint}</span>}
      </h2>
      {children}
    </section>
  );
}

/** The save bar at the bottom of the page. */
export function StepNav({ next, children }: { next?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
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
