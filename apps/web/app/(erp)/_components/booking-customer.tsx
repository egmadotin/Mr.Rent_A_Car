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
import { CUSTOMER_FIELDS, customerValues, type CustomerField } from "./booking-values";
import { FieldShell as F, PAYMENT_METHOD_OPTIONS } from "./form";

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

/** The Customer tab grid in the order a legacy form lays it out; the First Name search icon runs "Check Matching". */
export function CustomerFields({ layout, bind, onFind, children }: { layout: CustomerLayout; bind: Bind; onFind: () => void; children?: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {layout.map((cell, i) => {
        if (typeof cell === "number") return <div key={`gap${i}`} className={cell > 1 ? "hidden lg:col-span-3 lg:block" : "hidden lg:block"} />;
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

/** The "Customer Notes" box under the profile fields (saved as a customer memo). */
export function CustomerNotes({ bind }: { bind: Bind }) {
  return <F label="Customer Notes" name="customerMemo" className="sm:col-span-2"><Textarea rows={3} {...bind("customerMemo")} /></F>;
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
}: {
  bind: Bind;
  onSubmit: () => void;
  transactionTypes: [string, string][];
  codeLabels?: [string, string];
  pendingNote?: number | null;
}) {
  return (
    <Card className="gap-3">
      <CardHeader><CardTitle>Payment Information</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ccSwipe">Swipe Credit Card Here Or</Label><Input id="ccSwipe" className="max-w-24" autoComplete="off" /></div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1"><Label htmlFor="cc">Credit Card</Label><PlusCircleIcon className="size-3.5 text-primary" aria-hidden /></div>
          <NativeSelect id="cc" value="" onChange={() => {}}><option value="" /></NativeSelect>
        </div>
        <div className="space-y-1.5"><Label htmlFor="cvv">CVV</Label><Input id="cvv" inputMode="numeric" maxLength={4} autoComplete="off" /></div>
        <F label="Payment Method" name="payMethod" required><NativeSelect {...bind("payMethod")}><option value="">Please select</option>{PAYMENT_METHOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></F>
        <F label="Amount" name="payAmount" required><Input type="number" min={0.01} step="0.01" {...bind("payAmount")} /></F>
        <F label="Transaction Type" name="payType">
          <NativeSelect {...bind("payType")}>{transactionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
        </F>
        <div className="grid grid-cols-2 gap-2">
          <F label={codeLabels[0]} name="payAuth"><Input {...bind("payAuth")} /></F>
          <F label={codeLabels[1]} name="payTxn"><Input {...bind("payTxn")} /></F>
        </div>
        <div className="sm:col-span-2">
          <Button type="button" className="w-full sm:w-1/2" onClick={onSubmit}>Submit</Button>
          {pendingNote != null && <p className="mt-1 text-xs text-muted-foreground">Payment of {money(pendingNote)} will be applied when this is saved.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
