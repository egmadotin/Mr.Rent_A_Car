/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import { CarFrontIcon } from "lucide-react";
import { money } from "@mrac/ui/lib/format";
import { isPercentLine } from "@mrac/ui/lib/charge-lines";

type Line = { kind: string; name: string; total: unknown; sortOrder?: number | null };

/**
 * The top of mrrentacar.com's Rental Options / Reservation Information steps: pick-up and return (location, date) and the
 * vehicle (photo, class) on the left; the charges on the right — "Rental Charges", each protection / option / fixed tax,
 * "Sub Total", the % taxes and "Total".
 */
export function BookingSummary({
  pickup,
  dropoff,
  vehicle,
  lines,
  total,
}: {
  pickup: { location: string; when: string };
  dropoff: { location: string; when: string };
  vehicle?: { name: string; imageKey?: string | null };
  lines?: Line[];
  total?: unknown;
}) {
  const time = (lines ?? []).filter((l) => l.kind === "TIME" || l.kind === "UPGRADE");
  const rest = (lines ?? []).filter((l) => !["TIME", "UPGRADE", "MILEAGE"].includes(l.kind));
  const pctTax = rest.filter((l) => l.kind === "TAX" && isPercentLine(l));
  const before = rest.filter((l) => !pctTax.includes(l));
  const sum = (xs: Line[]) => xs.reduce((a, l) => a + Number(l.total ?? 0), 0);
  const rows: [string, number, boolean?][] = lines
    ? [
        ["Rental Charges", sum(time), true],
        ...before.map((l) => [l.name, Number(l.total ?? 0)] as [string, number]),
        ["Sub Total", sum(time) + sum(before), true],
        ...pctTax.map((l) => [l.name, Number(l.total ?? 0)] as [string, number]),
      ]
    : [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted px-5 py-4 text-xs uppercase">
          {[pickup, dropoff].map((p, i) => (
            <div key={i}>
              <div className="font-medium">{p.location}</div>
              <div className="mt-1 text-muted-foreground">{p.when}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <div className="grid h-24 w-36 shrink-0 place-items-center">
            {vehicle?.imageKey ? <img src={vehicle.imageKey} alt={vehicle.name} className="max-h-full max-w-full object-contain" /> : <CarFrontIcon className="size-12 text-muted-foreground/50" aria-hidden />}
          </div>
          <div className="text-2xl">{vehicle?.name ?? "…"}</div>
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value, shade], i) => (
            <tr key={i} className={shade || i % 2 === 0 ? "bg-muted/70" : undefined}>
              <td className="px-2.5 py-1.5 text-muted-foreground">{label}</td>
              <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{money(value)}</td>
            </tr>
          ))}
          {lines && (
            <tr>
              <td className="px-2.5 py-1.5 font-semibold">Total</td>
              <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{money(Number(total ?? 0))}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Page banner used by the booking steps ("Rental Options", "Reservation Information"). */
export function BookingBanner({ title }: { title: string }) {
  return (
    <section className="bg-secondary text-secondary-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
      </div>
    </section>
  );
}

/** "10/20/2026 10:00 AM" — the live site's date format. */
export function legacyStamp(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "");
}
