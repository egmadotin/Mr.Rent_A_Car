"use client";

import * as React from "react";
import { PlusCircleIcon, SearchIcon, UsersIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Textarea } from "@mrac/ui/components/textarea";
import { COUNTRIES } from "@mrac/ui/lib/countries";
import { date, money } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { cn } from "@mrac/ui/lib/utils";
import { CUSTOMER_FIELDS, customerValues, type CustomerField } from "./booking-values";
import { FieldShell as F } from "./form";
import { usePaymentMethods } from "./payment-methods";
import { cardExpired, parseCardSwipe, type SwipedCard } from "./customer-checks";
import { FloatingWindow, WindowCard } from "./extras-window";

// server-safe customer helpers live in booking-values.ts; re-exported for the client forms
export { CUSTOMER_FIELDS, customerValues, type CustomerField };

const KIND: Partial<Record<CustomerField, "tel" | "email" | "date" | "region" | "country">> = {
  phone: "tel", localPhone: "tel", companyPhone: "tel", insurancePhone: "tel", insuranceFax: "tel", email: "email",
  licenseExpiry: "date", birthDate: "date", insuranceExpiry: "date", licenseProvince: "region", province: "region", country: "country",
};

/** One cell of a Customer tab: [field, legacy label, required?], or a number = empty columns (keeps the legacy rows aligned). */
export type CustomerLayout = ([CustomerField, string, boolean?] | number)[];

type Bind = (name: string) => {
  id: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  "aria-invalid"?: true;
};

/** Insurance fields of a Customer tab: shown under "More" so the main fields fit beside the trip. */
const INSURANCE: CustomerField[] = ["insuranceCompany", "insurancePolicyNumber", "insuranceExpiry", "insurancePhone", "insuranceFax"];
/** A legacy Customer layout split into [main fields, insurance fields] (the order inside each is kept). */
export function splitInsurance(layout: CustomerLayout): [CustomerLayout, CustomerLayout] {
  const isIns = (c: CustomerLayout[number]) => typeof c !== "number" && INSURANCE.includes(c[0]);
  const main = layout.filter((c) => !isIns(c));
  // a trailing alignment gap is pointless once the insurance rows are gone
  while (typeof main[main.length - 1] === "number") main.pop();
  return [main, layout.filter(isIns)];
}

/** The Customer tab grid in the order a legacy form lays it out; the First Name search icon runs "Check Matching". */
export function CustomerFields({ layout, bind, onFind, children, className }: { layout: CustomerLayout; bind: Bind; onFind: () => void; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {layout.map((cell, i) => {
        if (typeof cell === "number") return <div key={`gap${i}`} className={cell > 1 ? "booking-gap hidden lg:col-span-3 lg:block" : "booking-gap hidden lg:block"} />;
        const [key, label, required] = cell;
        const id = `cust-${key}`;
        const b = { ...bind(key), id };
        const kind = KIND[key];
        let input: React.ReactNode;
        if (kind === "region" || kind === "country") {
          const base = kind === "country" ? COUNTRIES : REGION_OPTIONS;
          const list = [...new Set([...base, ...(b.value ? [b.value] : [])])];
          input = <NativeSelect {...b}><option value="">Please select</option>{list.map((r) => <option key={r}>{r}</option>)}</NativeSelect>;
        } else if (key === "firstName") {
          input = (
            <div className="relative">
              <Input {...b} autoComplete="off" className="pr-8" />
              <button type="button" aria-label="Find customer" onClick={onFind} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"><SearchIcon className="size-4" /></button>
            </div>
          );
        } else input = <Input type={kind ?? "text"} {...b} autoComplete="off" />;
        return <F key={key} label={label} name={id} errorKey={`customer.${key}`} required={required}>{input}</F>;
      })}
      {children}
    </div>
  );
}

/**
 * The "Customer Notes" box under the profile fields (saved as a customer memo), and RentCentric's "Add More Information"
 * button beside it: the customer's other details (CustomerInfoMore.aspx — gender, title, referral, employer, passport,
 * memberships, preferred / undesired …) are on the full customer form, opened in a new tab.
 */
export function CustomerNotes({ bind, customerId }: { bind: Bind; customerId?: string | null }) {
  return (
    <>
      <F label="Customer Notes" name="customerMemo" className="sm:col-span-2"><Textarea rows={3} {...bind("customerMemo")} /></F>
      <div className="flex items-start pt-6">
        {customerId ? (
          <Button asChild className="w-full"><a href={`/admin/customers/${customerId}/edit`} target="_blank" rel="noreferrer">Add More Information</a></Button>
        ) : (
          <Button type="button" className="w-full" disabled title="Find or save the customer first">Add More Information</Button>
        )}
      </div>
    </>
  );
}

type Match = {
  id: string; firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null;
  licenseNumber: string | null; birthDate: Date | string | null; isUndesired: boolean; isActive: boolean;
};

/** "Check Matching" results: existing customers to use instead of creating a duplicate. */
export function MatchList<T extends Match>({ matches, onUse }: { matches: T[] | undefined; onUse: (c: T) => void }) {
  if (!matches?.length) return null;
  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <UsersIcon className="size-4" /> {matches.length} matching customer{matches.length > 1 ? "s" : ""}
      </p>
      <ul className="divide-y rounded-md border bg-card text-sm">
        {matches.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
            <span>
              <span className="font-medium">{[c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")}</span>{" "}
              <span className="text-muted-foreground">{[c.phone, c.email, c.licenseNumber && `Lic ${c.licenseNumber}`, c.birthDate && `DOB ${date(c.birthDate)}`].filter(Boolean).join(" · ")}</span>{" "}
              {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
              {!c.isActive && <Badge variant="muted">Inactive</Badge>}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => onUse(c)}>Use this customer</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Payment on the booking screen: a one-line card ("Take payment") that opens the Payment Information panel in a movable window. */
export function PaymentWindow({ summary, ...card }: React.ComponentProps<typeof PaymentInfoCard> & { summary: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <WindowCard title="Payment" summary={summary} button="Take payment" onOpen={() => setOpen(true)} />
      <FloatingWindow open={open} onClose={() => setOpen(false)} title="Payment Information">
        <PaymentInfoCard {...card} />
      </FloatingWindow>
    </>
  );
}

/**
 * The "Payment Information" panel (Swipe, Credit Card ⊕, CVV, Payment Method, Amount, Transaction Type, codes, Submit).
 * `transactionTypes` keeps each legacy screen's own order and wording; `pendingNote` explains a payment held until save.
 */
export function PaymentInfoCard({
  bind,
  onSubmit,
  transactionTypes,
  codeLabels = ["Authorization Code", "Transaction Code"],
  pendingNote,
  locationId,
  set,
  wide,
}: {
  bind: Bind;
  /** the swipe box on the title line and the fields three across (on the booking screen, under the customer) */
  wide?: boolean;
  /** sets a form value: the card swipe fills Payment Method and the card's last 4 digits */
  set?: (name: string, value: string) => void;
  onSubmit: () => void;
  transactionTypes: [string, string][];
  codeLabels?: [string, string];
  pendingNote?: number | null;
  /** the booking's pickup location: its own payment methods are offered too */
  locationId?: string | null;
}) {
  const pm = usePaymentMethods(locationId);
  const [swipe, setSwipe] = React.useState("");
  const [card, setCard] = React.useState<SwipedCard | null>(null);
  const [swipeError, setSwipeError] = React.useState<string | null>(null);
  // a reader types the stripe then Enter; the raw text (with the full number) is dropped straight away
  const readSwipe = (raw: string) => {
    const c = parseCardSwipe(raw);
    setSwipe("");
    if (!c) return setSwipeError("Couldn't read the card — swipe again, or enter the details by hand.");
    setSwipeError(null);
    setCard(c);
    set?.("payLast4", c.last4);
    if (c.brand !== "OTHER" && pm.options.some((o) => o.value === c.brand)) set?.("payMethod", c.brand);
  };
  const expired = card ? cardExpired(card.expMonth, card.expYear) : false;
  const swipeInput = (
    <Input
      id="ccSwipe"
      className={wide ? "w-56 max-w-full" : "max-w-xs"}
      autoComplete="off"
      placeholder="Click here, then swipe the card"
      value={swipe}
      onChange={(e) => {
        const t = e.target.value;
        setSwipe(t);
        // some readers end with "?" and no Enter
        if (/\?\s*$/.test(t) && /[\^=]/.test(t) && parseCardSwipe(t)) readSwipe(t);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (swipe) readSwipe(swipe);
      }}
    />
  );
  const swipeNotes = (
    <>
      {swipeError && <p className="text-xs text-destructive">{swipeError}</p>}
      {card && (
        <p className={expired ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"}>
          {card.label} •••• {card.last4} · Exp {String(card.expMonth).padStart(2, "0")}/{card.expYear}{card.holder ? ` · ${card.holder}` : ""}{expired ? " — this card has EXPIRED" : ""}
        </p>
      )}
    </>
  );
  return (
    <Card className="gap-3">
      {wide ? (
        // wide: the swipe box on the title line, the fields three across (fits under the customer on the booking screen)
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Payment Information</CardTitle>
          <div className="flex min-w-0 items-center gap-2">
            <Label htmlFor="ccSwipe" className="font-normal text-muted-foreground">Swipe Credit Card Here Or</Label>
            {swipeInput}
          </div>
        </CardHeader>
      ) : (
        <CardHeader><CardTitle>Payment Information</CardTitle></CardHeader>
      )}
      <CardContent className={cn("grid gap-3", wide ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {wide ? (
          (swipeError || card) && <div className="space-y-1 sm:col-span-3">{swipeNotes}</div>
        ) : (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ccSwipe">Swipe Credit Card Here Or</Label>
            {swipeInput}
            {swipeNotes}
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1"><Label htmlFor="payLast4">Credit Card (last 4)</Label><PlusCircleIcon className="size-3.5 text-primary" aria-hidden /></div>
          <Input {...bind("payLast4")} id="payLast4" inputMode="numeric" maxLength={4} placeholder="1234" autoComplete="off" />
        </div>
        <div className="space-y-1.5"><Label htmlFor="cvv">CVV</Label><Input id="cvv" inputMode="numeric" maxLength={4} autoComplete="off" /></div>
        <F label="Payment Method" name="payMethod" required><NativeSelect {...bind("payMethod")}><option value="">Please select</option>{pm.options.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></F>
        <F label="Amount" name="payAmount" required><Input type="number" min={0.01} step="0.01" {...bind("payAmount")} /></F>
        <F label="Transaction Type" name="payType">
          <NativeSelect {...bind("payType")}>{transactionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
        </F>
        {!wide && <div className="hidden sm:block" />}
        <F label={codeLabels[0]} name="payAuth"><Input {...bind("payAuth")} /></F>
        <F label={codeLabels[1]} name="payTxn"><Input {...bind("payTxn")} /></F>
        <div className={wide ? "flex flex-col justify-end sm:col-span-2" : "sm:col-span-2"}>
          {pendingNote != null && wide && <p className="mb-1 text-xs text-muted-foreground">Payment of {money(pendingNote)} will be applied when this is saved.</p>}
          <Button type="button" className={wide ? "w-full sm:w-1/2" : "w-full sm:w-1/2"} onClick={onSubmit}>Submit</Button>
          {pendingNote != null && !wide && <p className="mt-1 text-xs text-muted-foreground">Payment of {money(pendingNote)} will be applied when this is saved.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
