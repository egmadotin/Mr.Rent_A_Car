"use client";

import * as React from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";

/**
 * Booking forms as steps (client request): Customer → Trip & vehicle → Extras → Summary & payment, one screen each, like a
 * checkout. Every step stays mounted (hidden) so nothing typed is lost when moving back and forth.
 */
export type Step = { key: string; label: string; hint?: string };

export function StepHeader({ steps, current, onGo, reached }: { steps: Step[]; current: number; onGo: (i: number) => void; reached: number }) {
  return (
    <nav aria-label="Booking steps" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2">
        {steps.map((s, i) => {
          const done = i < current;
          const can = i <= reached;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className={cn("h-px w-6 sm:w-10", i <= current ? "bg-primary" : "bg-border")} aria-hidden />}
              <button
                type="button"
                disabled={!can}
                onClick={() => onGo(i)}
                aria-current={i === current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-2 py-1 text-sm transition-colors",
                  i === current ? "font-semibold text-foreground" : can ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    i === current && "border-primary bg-primary text-primary-foreground",
                    done && "border-primary text-primary",
                  )}
                >
                  {done ? <CheckIcon className="size-4" /> : i + 1}
                </span>
                <span className="text-left leading-tight">
                  {s.label}
                  {s.hint && <span className="block text-xs font-normal text-muted-foreground">{s.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One step's content; kept mounted while hidden. */
export function StepPanel({ active, children, className }: { active: boolean; children: React.ReactNode; className?: string }) {
  return <div hidden={!active} className={cn("space-y-4", className)}>{children}</div>;
}

/** Back / Next (or the final action) at the bottom of each step. */
export function StepNav({ onBack, onNext, nextLabel = "Next", next, children }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; next?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        {onBack && <Button type="button" variant="outline" onClick={onBack}><ChevronLeftIcon /> Back</Button>}
        {children}
      </div>
      {next ?? (onNext && <Button type="button" onClick={onNext}>{nextLabel} <ChevronRightIcon /></Button>)}
    </div>
  );
}

/** The booking at a glance, on every step: customer, dates, vehicle, total. */
export function BookingSummaryBar({ customer, from, to, vehicle, total, days }: { customer: string; from?: string; to?: string; vehicle?: string; total?: number | null; days?: number | string }) {
  const item = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 sm:grid-cols-5">
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
