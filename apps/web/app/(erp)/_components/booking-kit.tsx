"use client";

import * as React from "react";
import { AlertCircleIcon, AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { BUSINESS_TZ, fromDateTimeLocal, money, toDateTimeLocal } from "@mrac/ui/lib/format";
import { nowInput, todayAtInput } from "@mrac/ui/lib/tz";
import { isPercentLine } from "@mrac/ui/lib/charge-lines";

/**
 * Pieces shared by the Quote and Reservation forms (the same booking fields in RentCentric).
 * Pickup/return times are always entered in the pickup location's time zone.
 */

/** "Mountain time" / "Pacific time" label for a Canadian zone. */
export function tzLabel(tz: string) {
  return tz === "America/Edmonton" ? "Mountain time" : tz === "America/Vancouver" ? "Pacific time" : tz;
}

/**
 * Initial datetime-local values. Saved records pass ISO instants plus `timeZone` (the pickup location's zone).
 * New bookings use the RentCentric defaults: Add Quote = now → same time tomorrow; Reserve = 9:00 AM today →
 * 9:00 AM tomorrow (`defaultAt: "09:00"`).
 */
export function initialBookingTimes(values: { pickupAt?: unknown; returnAt?: unknown; timeZone?: unknown } = {}, { defaultAt }: { defaultAt?: string } = {}) {
  const tz = typeof values.timeZone === "string" && values.timeZone ? values.timeZone : BUSINESS_TZ;
  const fresh = defaultAt ? [todayAtInput(defaultAt, tz), todayAtInput(defaultAt, tz, 1)] : [nowInput(tz), nowInput(tz, 86_400_000)];
  return {
    pickupAt: typeof values.pickupAt === "string" && values.pickupAt ? toDateTimeLocal(values.pickupAt, tz) : fresh[0],
    returnAt: typeof values.returnAt === "string" && values.returnAt ? toDateTimeLocal(values.returnAt, tz) : fresh[1],
  };
}

/** The entered window as instants, in the pickup location's zone. */
export function bookingWindow(locations: { id: string; timeZone: string }[] | undefined, pickupLocationId: string, pickupAt: string, returnAt: string) {
  const tz = locations?.find((l) => l.id === pickupLocationId)?.timeZone ?? BUSINESS_TZ;
  const p = pickupAt ? fromDateTimeLocal(pickupAt, tz) : null;
  const r = returnAt ? fromDateTimeLocal(returnAt, tz) : null;
  return { tz, pickupAt: p, returnAt: r, valid: !!p && !!r && +r > +p };
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircleIcon className="size-4" /> {message}
    </div>
  );
}

type Bind = (name: string) => { id: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void };

/** Discount: type (blank / % / $) + value; the value is disabled until a type is picked. RentCentric labels it "Discount %". */
export function DiscountField({ bind, error, label = "Discount %", noBlank }: { bind: Bind; error?: string; label?: string; /** Reserve form: only % / $ (no blank) */ noBlank?: boolean }) {
  const type = bind("discountType");
  return (
    <div className="space-y-1.5">
      <Label htmlFor="discountValue">{label}</Label>
      <div className="flex gap-2">
        <NativeSelect className="w-20" {...type} aria-label="Discount type">
          {!noBlank && <option value="" />}
          <option value="PERCENT">%</option>
          <option value="AMOUNT">$</option>
        </NativeSelect>
        <Input type="number" min={0} step="0.01" placeholder={noBlank ? "0.0" : undefined} {...bind("discountValue")} disabled={!noBlank && !type.value} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

type Preview = { lines: { name: string; units: unknown; kind: string; rate?: unknown; total: unknown; sortOrder?: number }[]; total: unknown; warnings: string[] };

/**
 * Live estimate beside the options (extras step): every priced line with its unit × rate underneath, and a large
 * total. Updates as options are ticked, nothing is saved.
 */
export function EstimatePanel({ preview, fetching, emptyText, badge }: { preview: Preview | null | undefined; fetching?: boolean; emptyText: string; badge?: React.ReactNode }) {
  return (
    <aside className="rounded-xl border bg-card p-4 text-sm shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Estimate</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {fetching && <Loader2Icon className="size-3.5 animate-spin" aria-label="Updating" />}
          {badge}
        </span>
      </div>
      {!preview ? (
        <p className="mt-2 text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border/50">
            {preview.lines.map((l, i) => {
              const units = Number(l.units) || 0;
              const detail =
                l.kind === "MILEAGE" ? "" : l.rate == null ? "" : isPercentLine(l) ? `${Number(l.rate)}%` : units > 1 ? `${units} × ${money(Number(l.rate))}` : "";
              return (
                <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    {l.name}
                    {detail && <span className="block text-xs text-muted-foreground tabular-nums">{detail}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{l.kind === "MILEAGE" ? <span className="text-muted-foreground">{units ? `${units} km` : "Unlimited"}</span> : money(l.total as number)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t pt-3">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-semibold tabular-nums">{money(preview.total as number)}</span>
          </div>
          {preview.warnings.map((w) => (
            <p key={w} className="mt-2 flex gap-1.5 text-xs text-warning-foreground dark:text-warning">
              <AlertTriangleIcon className="size-3.5 shrink-0" /> {w}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}

/** Live priced charge lines + total, as shown beside the booking forms. */
export function ChargeSummary({ title, preview, emptyText }: { title: string; preview: Preview | null | undefined; emptyText: string }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!preview ? (
          <p className="text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            {/* RentCentric columns: Charge · Unit · Rate · Total */}
            <table className="w-full">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 pr-2 font-medium">Charge</th>
                  <th className="py-1 pr-2 text-right font-medium">Unit</th>
                  <th className="py-1 pr-2 text-right font-medium">Rate</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1 pr-2">{l.name}</td>
                    <td className="py-1 pr-2 text-right text-muted-foreground tabular-nums">{Number(l.units) || ""}</td>
                    <td className="py-1 pr-2 text-right text-muted-foreground tabular-nums">{l.kind === "MILEAGE" || l.rate == null ? "" : isPercentLine(l) ? `${Number(l.rate)}%` : money(Number(l.rate))}</td>
                    <td className="py-1 text-right tabular-nums">{l.kind === "MILEAGE" ? "" : money(l.total as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(preview.total as number)}</span>
            </div>
            {preview.warnings.map((w) => (
              <p key={w} className="mt-2 flex gap-1.5 text-xs text-warning-foreground dark:text-warning">
                <AlertTriangleIcon className="size-3.5 shrink-0" /> {w}
              </p>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
