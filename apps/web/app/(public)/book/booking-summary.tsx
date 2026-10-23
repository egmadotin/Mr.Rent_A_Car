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
  promo,
}: {
  pickup: { location: string; when: string };
  dropoff: { location: string; when: string };
  vehicle?: { name: string; imageKey?: string | null };
  lines?: Line[];
  total?: unknown;
  /** the promo code's result (applied, or why not) */
  promo?: { ok: boolean; message: string } | null;
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
    <div className="grid overflow-hidden rounded-card border bg-card lg:grid-cols-[1fr_1fr]">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[pickup, dropoff].map((p, i) => (
            <div key={i}>
              <div className="text-xs font-semibold text-muted-foreground">{i === 0 ? "Pick-up" : "Return"}</div>
              <div className="mt-0.5 font-semibold">{p.location}</div>
              <div className="text-muted-foreground">{p.when}</div>
            </div>
          ))}
        </div>
        <div className="studio flex items-center gap-5 rounded-control p-4">
          <div className="grid h-24 w-40 shrink-0 place-items-center">
            {vehicle?.imageKey ? <img src={vehicle.imageKey} alt={vehicle.name} className="max-h-full max-w-full object-contain" /> : <CarFrontIcon className="size-12 text-muted-foreground/50" aria-hidden />}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Your car</div>
            <div className="type-title-3">{vehicle?.name ?? "…"}</div>
          </div>
        </div>
      </div>
      <div className="border-t bg-muted/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
        <h2 className="text-[13px] font-semibold text-muted-foreground">Price summary</h2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map(([label, value, strong], i) => (
              <tr key={i} className={strong ? "font-semibold" : undefined}>
                <td className={strong ? "py-1.5" : "py-1.5 text-muted-foreground"}>{label}</td>
                <td className="py-1.5 text-right tabular-nums">{money(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines ? (
          <div className="mt-3 flex items-end justify-between border-t pt-4">
            <div>
              <div className="font-semibold">Total</div>
              <div className="text-xs text-muted-foreground">Taxes and fees included · CAD</div>
            </div>
            <div className="type-price">{money(Number(total ?? 0))}</div>
          </div>
        ) : (
          <div className="mt-3 h-24 animate-pulse rounded-control bg-muted" />
        )}
        {promo && (
          <p role="status" className={promo.ok ? "mt-4 rounded-control bg-green-tint px-3 py-2 text-sm font-semibold text-racing" : "mt-4 rounded-control bg-blush px-3 py-2 text-sm font-semibold text-brand"}>
            {promo.message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Page title used by the booking steps. */
export function BookingBanner({ title }: { title: string }) {
  return <h1 className="type-title-2">{title}</h1>;
}

/** "10/20/2026 10:00 AM" — the live site's date format. */
export function legacyStamp(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "");
}
