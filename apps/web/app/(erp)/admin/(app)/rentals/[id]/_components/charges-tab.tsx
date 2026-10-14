"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { Field, FormDialog, SelectField } from "../../../../../_components/form";
import { Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";

type Line = RentalData["rental"]["chargeLines"][number];

/** Same structure as the legacy charge table, in the same order. */
export function ChargeTable({ data }: { data: RentalData }) {
  const { chargeLines, payments } = data.rental;
  const t = data.totals;
  const of = (...kinds: string[]) => chargeLines.filter((l) => kinds.includes(l.kind));
  const isAmountTax = (l: Line) => l.kind === "TAX" && l.tax?.kind === "AMOUNT";

  const rows: React.ReactNode[] = [];
  const line = (l: Line) => (
    <TableRow key={l.id}>
      <TableCell>{l.name}</TableCell>
      <TableCell className="text-right tabular-nums">{Number(l.units) ? Number(l.units).toLocaleString() : ""}</TableCell>
      <TableCell className="text-right tabular-nums">{l.kind === "TAX" && !isAmountTax(l) ? `${Number(l.rate)}%` : Number(l.rate) ? money(l.rate) : ""}</TableCell>
      <TableCell className="text-right tabular-nums">{l.kind === "MILEAGE" && !Number(l.total) ? "" : money(l.total)}</TableCell>
    </TableRow>
  );
  const subtotal = (label: string, value: { toString(): string }, strong?: boolean, key = label) => (
    <TableRow key={key} className={cn("bg-muted/40", strong && "font-semibold")}>
      <TableCell colSpan={3}>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{money(value)}</TableCell>
    </TableRow>
  );

  rows.push(...of("TIME", "MILEAGE", "UPGRADE").map(line));
  const r = data.rental;
  if (r.odometerIn != null)
    rows.push(
      <TableRow key="km-driven">
        <TableCell>KM Driven</TableCell>
        <TableCell className="text-right tabular-nums">{(r.odometerIn - r.odometerOut).toLocaleString()}</TableCell>
        <TableCell colSpan={2} />
      </TableRow>,
    );
  rows.push(subtotal("Total T&KM", t.timeAndKm));
  if (of("DISCOUNT").length) rows.push(...of("DISCOUNT").map(line));
  if (of("FUEL", "PREPAID_FUEL").length) rows.push(...of("FUEL", "PREPAID_FUEL").map(line));
  const options = of("PROTECTION", "MISC", "ONE_WAY", "DAMAGES", "OTHER");
  if (options.length) rows.push(...options.map(line), subtotal("Options Total", t.options));
  rows.push(...chargeLines.filter(isAmountTax).map(line));
  rows.push(...of("TRAFFIC_TICKETS").map(line), ...of("ADMIN").map(line));
  rows.push(subtotal("Sub Total", t.subTotal, true));
  rows.push(...chargeLines.filter((l) => l.kind === "TAX" && !isAmountTax(l)).map(line));
  rows.push(subtotal("Total", t.total, true));
  for (const p of payments)
    rows.push(
      <TableRow key={p.id} className="text-muted-foreground">
        <TableCell colSpan={3}>
          {p.method}
          {p.cardLast4 && ` XXXX${p.cardLast4}`}
          {p.authorizationCode && ` · Auth ${p.authorizationCode}`}
          {p.transactionType !== "PAYMENT" && ` · ${p.transactionType === "AUTHORIZATION" ? "Authorization (hold)" : "Refund"}`}
        </TableCell>
        <TableCell className="text-right tabular-nums">{money(p.transactionType === "REFUND" ? -Number(p.amount) : p.amount)}</TableCell>
      </TableRow>,
    );
  rows.push(subtotal("Total Payments", t.totalPayments, false), subtotal("Balance", t.balance, true));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Charge</TableHead>
          <TableHead className="text-right">Unit</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{rows}</TableBody>
    </Table>
  );
}

const ADJUSTMENT_ITEMS: { value: string; label: string }[] = [
  { value: "TIME", label: "Time" },
  { value: "MILEAGE", label: "Mileage" },
  { value: "UPGRADE", label: "Upgrade" },
  { value: "FUEL", label: "Fuel" },
  { value: "PREPAID_FUEL", label: "Prepaid Fuel" },
  { value: "TRAFFIC_TICKETS", label: "Traffic Tickets" },
  { value: "DISCOUNT", label: "Discount" },
  { value: "OTHER:1", label: "Other Charges 1" },
  { value: "OTHER:2", label: "Other Charges 2" },
  { value: "OTHER:3", label: "Other Charges 3" },
  { value: "OTHER:4", label: "Other Charges 4" },
  { value: "ONE_WAY", label: "One way" },
  { value: "DAMAGES", label: "Damages" },
];

export function ChargesTab({ data }: { data: RentalData }) {
  const r = data.rental;
  const trpc = useTRPC();
  const opts = useQuery(trpc.staff.rental.formOptions.queryOptions()).data;
  const { api, run } = useRentalActions(r.id);
  const items = [...ADJUSTMENT_ITEMS, ...(opts?.miscCharges ?? []).map((m) => ({ value: `MISC:${m.id}`, label: m.name }))];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Section title="Charges" flush>
        <ChargeTable data={data} />
      </Section>

      <Section
        title="Adjustments"
        count={r.adjustments.length}
        flush
        action={
          <FormDialog
            title="Add adjustment"
            description="Adjust one charge item. Use a negative amount to credit."
            trigger={
              <Button size="sm" variant="outline">
                <PlusIcon /> Add
              </Button>
            }
            onSubmit={(v) => {
              const [kind, ref] = String(v.item).split(":");
              const label = items.find((i) => i.value === v.item)?.label ?? String(v.item);
              return run(
                api.addAdjustment.mutate({
                  rentalId: r.id,
                  kind: kind as "TIME",
                  miscChargeId: kind === "MISC" ? ref : undefined,
                  name: label,
                  amount: Number(v.amount),
                }),
              );
            }}
          >
            <SelectField label="Item" name="item" required options={items} />
            <Field label="Amount" name="amount" type="number" step="0.01" required />
          </FormDialog>
        }
      >
        {r.adjustments.length === 0 ? (
          <Empty>No adjustments.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Entered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.adjustments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(a.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateTime(a.enteredAt)} · {a.enteredBy?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
