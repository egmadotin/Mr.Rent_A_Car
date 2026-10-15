/* eslint-disable @next/next/no-img-element -- printed documents use plain <img> so they render identically in print */
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { isPercentLine } from "@mrac/ui/lib/charge-lines";

/** Company-wide details printed on every customer document (legacy print header / footer). */
export const COMPANY = {
  name: "Mr Rent A Car",
  logo: "/legacy/logo.webp",
  tollFree: "1.844.667.7368",
  website: "www.mrrentacar.com",
  thanks: "Thank you very much for your business.",
};

type Loc = {
  name: string;
  address1?: string | null;
  city?: string | null;
  province?: string | null;
  postal?: string | null;
  country?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
};

/**
 * Same information as the legacy header (logo, location address, toll-free / phone / fax / email, title),
 * laid out as a modern document header with the number and date beside the title.
 */
export function PrintHeader({ location, title, number, date }: { location: Loc; title: string; number?: React.ReactNode; date?: React.ReactNode }) {
  return (
    <header className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <img src={COMPANY.logo} alt={COMPANY.name} className="h-20 w-auto -ml-2" />
        <div className="text-right">
          <div className="text-2xl font-bold tracking-tight text-[oklch(0.5_0.2_27)] uppercase">{title}</div>
          {number != null && <div className="mt-1 text-sm font-semibold">#{number}</div>}
          {date && <div className="text-xs text-muted-foreground">{date}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 rounded-lg bg-muted/60 px-4 py-3 text-xs leading-5">
        <address className="not-italic">
          <div className="font-semibold">{location.name}</div>
          {location.address1 && <div>{location.address1}</div>}
          <div>{[location.city, location.province, location.postal].filter(Boolean).join(", ")}</div>
          {location.country && <div>{location.country}</div>}
        </address>
        <div className="text-right">
          <div>Toll free: {COMPANY.tollFree}</div>
          {location.phone && <div>Phone: {location.phone}</div>}
          {location.fax && <div>Fax: {location.fax}</div>}
          {location.email && <div>{location.email}</div>}
        </div>
      </div>
    </header>
  );
}

/** Label / value rows. Empty values are omitted. */
export function InfoRows({ rows, className }: { rows: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs", className)}>
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="min-w-0 font-medium break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/** A titled block (legacy grey section bar → card). */
export function PrintSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("break-inside-avoid rounded-lg border", className)}>
      <h2 className="border-b px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** "Your Vehicle": class photo + name, description and specs (legacy shows the same with the class image). */
export function VehicleCard({
  type,
  extra,
}: {
  type: { name: string; description?: string | null; imageKey?: string | null; doors?: number | null; seats?: number | null; luggage?: number | null; transmission?: string | null };
  extra?: React.ReactNode;
}) {
  const specs = [
    type.seats != null && `${type.seats} Passengers`,
    type.doors != null && `${type.doors} Doors`,
    type.luggage != null && `${type.luggage} Luggage`,
    type.transmission,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-4">
      {type.imageKey ? (
        <img src={type.imageKey} alt={type.name} className="h-24 w-40 shrink-0 rounded-md bg-white object-contain" />
      ) : (
        <div className="grid h-24 w-40 shrink-0 place-items-center rounded-md bg-muted text-xs text-muted-foreground">No photo</div>
      )}
      <div className="min-w-0 space-y-1 text-xs">
        <div className="text-base font-semibold">{type.name}</div>
        {type.description && <div className="text-muted-foreground">{type.description}</div>}
        {specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {specs.map((s) => (
              <span key={String(s)} className="rounded-full border px-2 py-0.5">{s}</span>
            ))}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}

type Line = { kind: string; name: string; units: unknown; rate: unknown; total: unknown; tax?: { kind: string } | null };
type Payment = { method: string; transactionType: string; amount: unknown; authorizationCode?: string | null; cardLast4?: string | null };

/**
 * Charges in the legacy order and with the legacy subtotals:
 * time + Km Allowed → Total T&M → options (protections, misc, other) + fixed-amount taxes → Options Total
 * → Sub Total → % taxes → Total [→ payments → Total Payments → Balance].
 */
/**
 * Legacy charge table order: time + mileage → "Total T&M" → options → "Options Total" → fixed-amount taxes
 * (e.g. Passenger Vehicle Rental Tax) → "Sub Total" → % taxes → Total (→ payments, Balance).
 */
export function PrintChargeTable({ lines, payments, timeLabel = "Total T&M" }: { lines: Line[]; payments?: Payment[]; timeLabel?: string }) {
  const n = (x: unknown) => Number(x ?? 0);
  const time = lines.filter((l) => ["TIME", "MILEAGE", "UPGRADE"].includes(l.kind));
  const isAmountTax = (l: Line) => l.kind === "TAX" && l.tax?.kind === "AMOUNT";
  const pctTax = lines.filter((l) => l.kind === "TAX" && !isAmountTax(l));
  const amountTax = lines.filter(isAmountTax);
  const options = lines.filter((l) => !["TIME", "MILEAGE", "UPGRADE", "TAX"].includes(l.kind));
  const sum = (xs: Line[]) => xs.reduce((a, l) => a + n(l.total), 0);
  const tm = sum(time);
  const opt = sum(options);
  const subTotal = tm + opt + sum(amountTax);
  const total = subTotal + sum(pctTax);
  const paid = (payments ?? []).reduce((a, p) => a + (p.transactionType === "PAYMENT" ? n(p.amount) : p.transactionType === "REFUND" ? -n(p.amount) : 0), 0);

  const row = (l: Line, i: number) => (
    <tr key={`${l.name}${i}`} className="border-b border-border/50">
      <td className="py-1.5 pl-3">{l.name}</td>
      <td className="py-1.5 text-right tabular-nums">{n(l.units) ? n(l.units).toLocaleString() : ""}</td>
      <td className="py-1.5 text-right tabular-nums">{l.kind === "MILEAGE" ? "" : isPercentLine(l) ? `${n(l.rate)}%` : money(n(l.rate))}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{l.kind === "MILEAGE" ? "" : money(n(l.total))}</td>
    </tr>
  );
  const sub = (label: string, value: number) => (
    <tr className="bg-muted/50 font-medium">
      <td className="py-1.5 pl-3" colSpan={3}>{label}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{money(value)}</td>
    </tr>
  );
  const totalRow = (label: string, value: number, big?: boolean) => (
    <div className={cn("flex justify-between gap-6 px-3 py-1.5", big && "rounded-md bg-[oklch(0.5_0.2_27)] py-2 text-base font-bold text-white")}>
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );

  return (
    <div className="space-y-3 break-inside-avoid">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="py-2 pl-3 font-semibold">Charge</th>
              <th className="py-2 text-right font-semibold">Unit</th>
              <th className="py-2 text-right font-semibold">Rate</th>
              <th className="py-2 pr-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {time.map(row)}
            {sub(timeLabel, tm)}
            {options.map(row)}
            {options.length > 0 && sub("Options Total", opt)}
            {amountTax.map(row)}
          </tbody>
        </table>
      </div>
      <div className="ml-auto w-72 text-xs">
        {totalRow("Sub Total", subTotal)}
        {pctTax.map((l, i) => (
          <div key={i} className="flex justify-between gap-6 px-3 py-1">
            <span className="text-muted-foreground">{l.name} ({n(l.rate)}%)</span>
            <span className="tabular-nums">{money(n(l.total))}</span>
          </div>
        ))}
        {totalRow("Total", total, true)}
        {payments && (
          <div className="mt-2 space-y-0.5">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between gap-6 px-3 py-0.5 text-muted-foreground">
                <span>
                  {p.method}
                  {p.cardLast4 ? ` ···· ${p.cardLast4}` : ""}
                  {p.authorizationCode ? ` · Auth ${p.authorizationCode}` : ""}
                  {p.transactionType === "AUTHORIZATION" ? " (hold)" : p.transactionType === "REFUND" ? " (refund)" : ""}
                </span>
                <span className="tabular-nums">{money(p.transactionType === "REFUND" ? -n(p.amount) : n(p.amount))}</span>
              </div>
            ))}
            {totalRow("Total Payments", paid)}
            <div className="flex justify-between gap-6 rounded-md border-2 border-foreground/80 px-3 py-1.5 font-bold">
              <span>Balance</span>
              <span className="tabular-nums">{money(total - paid)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintFooter() {
  return (
    <footer className="space-y-1 border-t pt-4 text-center text-xs text-muted-foreground">
      <p className="font-medium text-foreground">{COMPANY.thanks}</p>
      <p>Visit our website at {COMPANY.website} · Toll free {COMPANY.tollFree}</p>
    </footer>
  );
}

export function PrintPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="force-light min-h-dvh print:min-h-0">
      <div className="mx-auto max-w-3xl space-y-5 p-8 print:max-w-none print:p-0">{children}</div>
    </div>
  );
}
