import { CheckIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

const STEPS = ["Search", "Choose a car", "Rental options", "Your details", "Confirmed"];

export function BookingSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Booking progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border text-xs font-semibold",
              i < current && "border-primary bg-primary text-primary-foreground",
              i === current && "border-primary text-primary",
            )}
          >
            {i < current ? <CheckIcon className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-semibold" : "text-muted-foreground")}>{s}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
