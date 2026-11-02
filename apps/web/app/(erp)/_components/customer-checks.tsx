"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckCircle2Icon, SearchIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { date } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";

// ── Card swipe ──────────────────────────────────────────────────────────────

export type SwipedCard = { last4: string; brand: "VISA" | "MASTERCARD" | "AMEX" | "OTHER"; label: string; expMonth: number; expYear: number; holder: string };

/**
 * A magnetic-stripe reader "types" the card's track data into the focused box, then Enter. Track 1:
 * `%B<number>^<LAST>/<FIRST>^<YYMM>…?`, track 2: `;<number>=<YYMM>…?`. Only what the booking keeps is returned
 * (brand, last 4, expiry, name) — the full number is never kept or sent.
 */
export function parseCardSwipe(raw: string): SwipedCard | null {
  const t1 = raw.match(/%B(\d{12,19})\^([^^]*)\^(\d{2})(\d{2})/);
  const t2 = raw.match(/;(\d{12,19})=(\d{2})(\d{2})/);
  const pan = t1?.[1] ?? t2?.[1];
  if (!pan) return null;
  const yy = Number(t1?.[3] ?? t2?.[2]);
  const mm = Number(t1?.[4] ?? t2?.[3]);
  if (!(mm >= 1 && mm <= 12)) return null;
  const [last = "", first = ""] = (t1?.[2] ?? "").split("/");
  const holder = [first, last].map((s) => s.trim()).filter(Boolean).join(" ");
  const brand = /^4/.test(pan) ? "VISA" : /^(5[1-5]|2[2-7])/.test(pan) ? "MASTERCARD" : /^3[47]/.test(pan) ? "AMEX" : "OTHER";
  const label = { VISA: "Visa", MASTERCARD: "Mastercard", AMEX: "Amex", OTHER: "Card" }[brand];
  return { last4: pan.slice(-4), brand, label, expMonth: mm, expYear: 2000 + yy, holder };
}

/** Expired = past the end of its expiry month. */
export const cardExpired = (expMonth: number, expYear: number, at = new Date()) => new Date(expYear, expMonth, 1) <= at;

// ── Driver checks (always on: licence expiry, under 25, expired cards) ────────

export type CheckInput = {
  birthDate?: string | Date | null;
  licenseExpiry?: string | Date | null;
  cards?: { brand: string; last4: string; expMonth: number; expYear: number }[];
};
export type Check = { level: "bad" | "warn"; text: string };

const asDate = (v: string | Date | null | undefined) => (v ? new Date(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v) : null);
function ageAt(birth: Date, at: Date) {
  let a = at.getFullYear() - birth.getFullYear();
  if (at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate())) a--;
  return a;
}

/** The checks a counter agent must never miss, worked out from the customer's details and the booking dates. */
export function driverChecks(c: CheckInput, pickupAt?: Date | null, returnAt?: Date | null): Check[] {
  const out: Check[] = [];
  const at = pickupAt ?? new Date();
  const birth = asDate(c.birthDate);
  if (birth && !Number.isNaN(+birth)) {
    const age = ageAt(birth, at);
    if (age < 25) out.push({ level: "warn", text: `Under 25: ${age} years old at pick-up (young driver rules apply)` });
  } else out.push({ level: "warn", text: "No birth date: the driver's age can't be checked" });
  const lic = asDate(c.licenseExpiry);
  if (lic && !Number.isNaN(+lic)) {
    if (lic < at) out.push({ level: "bad", text: `Driver's licence expired on ${date(lic)}` });
    else if (returnAt && lic < returnAt) out.push({ level: "warn", text: `Driver's licence expires during the rental (${date(lic)})` });
  } else out.push({ level: "warn", text: "No driver's licence expiry on file" });
  for (const card of c.cards ?? [])
    if (cardExpired(card.expMonth, card.expYear, at)) out.push({ level: "bad", text: `${card.brand} •••• ${card.last4} expired ${String(card.expMonth).padStart(2, "0")}/${card.expYear}` });
  return out;
}

/** The checks as a compact list (nothing when all is fine, unless `showOk`). */
export function DriverChecks({ checks, showOk, className }: { checks: Check[]; showOk?: boolean; className?: string }) {
  if (!checks.length)
    return showOk ? <p className={cn("flex items-center gap-1.5 text-xs text-success", className)}><CheckCircle2Icon className="size-3.5" /> Licence, age and cards OK</p> : null;
  return (
    <ul className={cn("space-y-1", className)} aria-label="Driver checks">
      {checks.map((c) => (
        <li key={c.text} className={cn("flex items-start gap-1.5 text-xs font-medium", c.level === "bad" ? "text-destructive" : "text-warning")}>
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" /> {c.text}
        </li>
      ))}
    </ul>
  );
}

// ── Check Matching search ───────────────────────────────────────────────────

type Filters = { firstName: string; lastName: string; phone: string; email: string; licenseNumber: string };
const FILTERS: [keyof Filters, string][] = [["lastName", "Last Name"], ["firstName", "First Name"], ["phone", "Phone"], ["email", "Email"], ["licenseNumber", "Licence #"]];

/**
 * "Check Matching" (client request): a customer search with filters — type any of them (e.g. only the last name) and
 * pick a customer to fill the form. Each result shows the automatic checks for this booking.
 */
export function CustomerSearchDialog<T>({
  open, onOpenChange, initial, pickupAt, returnAt, onUse,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Partial<Filters>;
  pickupAt?: Date | null;
  returnAt?: Date | null;
  onUse: (c: T) => void;
}) {
  const trpc = useTRPC();
  const [f, setF] = React.useState<Filters>({ firstName: "", lastName: "", phone: "", email: "", licenseNumber: "" });
  const [q, setQ] = React.useState<Filters | null>(null);
  // opening starts from what is typed on the form
  React.useEffect(() => {
    if (!open) return;
    const start = { firstName: initial.firstName ?? "", lastName: initial.lastName ?? "", phone: initial.phone ?? "", email: initial.email ?? "", licenseNumber: initial.licenseNumber ?? "" };
    setF(start);
    setQ(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // search as you type (short pause)
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setQ(f), 300);
    return () => clearTimeout(t);
  }, [f, open]);
  const any = !!q && Object.values(q).some((x) => x.trim());
  const res = useQuery({ ...trpc.staff.reservation.customerSearch.queryOptions(q ?? {}), enabled: open && any, placeholderData: (p) => p });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Check Matching</DialogTitle>
          <DialogDescription>Search by any field — a last name alone is enough. Pick a customer to fill in the booking.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-5">
          {FILTERS.map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`cm-${k}`}>{label}</Label>
              <Input id={`cm-${k}`} autoComplete="off" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} autoFocus={k === "lastName"} />
            </div>
          ))}
        </div>
        <div className="max-h-[55vh] overflow-y-auto rounded-md border">
          {!any ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><SearchIcon className="size-4" /> Type in any field to search.</p>
          ) : !res.data?.length ? (
            <p className="p-4 text-sm text-muted-foreground">{res.isFetching ? "Searching…" : "No matching customers."}</p>
          ) : (
            <ul className="divide-y">
              {res.data.map((c) => {
                const checks = driverChecks({ birthDate: c.birthDate, licenseExpiry: c.licenseExpiry, cards: c.creditCards }, pickupAt, returnAt);
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => { onUse(c as T); onOpenChange(false); }} className="flex w-full flex-wrap items-start justify-between gap-3 p-3 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                      <div className="min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {[c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")}
                          {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
                          {!c.isActive && <Badge variant="muted">Inactive</Badge>}
                        </p>
                        <p className="text-muted-foreground">
                          {[c.phone, c.email, c.licenseNumber && `Lic ${c.licenseNumber}${c.licenseExpiry ? ` (exp ${date(c.licenseExpiry)})` : ""}`, c.birthDate && `DOB ${date(c.birthDate)}`, [c.city, c.province].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                        </p>
                        <DriverChecks checks={checks} showOk />
                      </div>
                      <span className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium">Use this customer</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
