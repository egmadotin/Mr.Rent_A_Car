import { cn } from "@mrac/ui/lib/utils";

/** mrrentacar.com booking header: "1 PICK-UP / SELECT VEHICLE · 2 RENT EXTRA OPTIONS / EXTRA OPTIONS · 3 YOUR CONTACT DETAILS / CONTACT INFORMATION". */
const STEPS = [
  ["Pick-up", "Select Vehicle"],
  ["Rent Extra Options", "Extra Options"],
  ["Your Contact Details", "Contact Information"],
] as const;

/** `current` is 1-based (2 = Rental Options, 3 = Reservation Information); past steps link back when `hrefs` are given. */
export function BookingSteps({ current, hrefs = [] }: { current: number; hrefs?: (string | undefined)[] }) {
  return (
    <ol className="grid grid-cols-3 border-b text-left" aria-label="Booking progress">
      {STEPS.map(([kicker, label], i) => {
        const n = i + 1;
        const on = n === current;
        const body = (
          <span className="flex items-center gap-3 py-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white", on ? "bg-foreground" : "bg-muted-foreground/60")}>{n}</span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] uppercase text-muted-foreground">{kicker}</span>
              <span className={cn("block truncate text-sm uppercase sm:text-base", on ? "text-sky-600 dark:text-sky-400" : "text-foreground")}>{label}</span>
            </span>
          </span>
        );
        return (
          <li key={label} aria-current={on ? "step" : undefined} className={cn("-mb-px border-b-2", on ? "border-foreground" : "border-transparent")}>
            {n < current && hrefs[i] ? <a href={hrefs[i]} className="block hover:opacity-80">{body}</a> : body}
          </li>
        );
      })}
    </ol>
  );
}
