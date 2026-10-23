import { CheckIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

/** Booking progress: 1 Choose your car · 2 Protection & extras · 3 Your details. */
const STEPS = ["Choose your car", "Protection & extras", "Your details"] as const;

/** `current` is 1-based (4 = done); past steps link back when `hrefs` are given. */
export function BookingSteps({ current, hrefs = [] }: { current: number; hrefs?: (string | undefined)[] }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-sm [scrollbar-width:none]" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const on = n === current;
        const done = n < current;
        const body = (
          <span className={cn("flex items-center gap-2.5 rounded-pill py-1.5 pr-4 pl-1.5 whitespace-nowrap", on && "bg-card ring-1 ring-border")}>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-pill text-xs font-bold",
                on && "bg-foreground text-background",
                done && "bg-green-tint text-racing",
                !on && !done && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckIcon className="size-4" strokeWidth={2.5} /> : n}
            </span>
            <span className={cn("font-semibold", on ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </span>
        );
        return (
          <li key={label} aria-current={on ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={cn("h-px w-6 shrink-0 sm:w-10", done || on ? "bg-foreground/40" : "bg-border")} />}
            {done && hrefs[i] ? (
              <a href={hrefs[i]} className="rounded-pill hover:bg-muted">
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
