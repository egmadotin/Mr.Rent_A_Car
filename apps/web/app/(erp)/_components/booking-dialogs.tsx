"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { money, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { CheckField, Field, FormDialog, SelectField, TextareaField } from "./form";

export const CLAIM_TYPES = [
  { value: "RENTER", label: "Renter" },
  { value: "THIRD_PARTY", label: "3rd Party" },
  { value: "OTHER", label: "Other" },
];

const str = (v: unknown) => (v as string | undefined) || undefined;

/** Payload accepted by both staff.rental.addBillSplit and staff.reservation.addBillSplit. */
export type BillSplitPayload = {
  companyId: string;
  claimType: "RENTER" | "THIRD_PARTY" | "OTHER";
  insuranceCompany?: string;
  policyNumber?: string;
  policyExpiry: Date | null;
  prePaid: number;
  lumpSum: number;
  amountPerDay: number;
  numberOfDays: number;
  adjuster?: string;
  insured?: string;
  roNumber?: string;
  poNumber?: string;
  lossDate: Date | null;
  claimNumber?: string;
  maxPay: number | null;
  percentCoPay: number;
  payAllTaxes: boolean;
  taxIds: string[];
  payTotal: boolean;
  deductFromCustomersBalance: boolean;
  memo?: string;
};

/** "Add Bill Split" — bill part of a booking to a company (insurer, ICBC, body shop, corporate). */
export function BillSplitDialog({ onSubmit }: { onSubmit: (p: BillSplitPayload) => Promise<unknown> }) {
  const trpc = useTRPC();
  const opts = useQuery(trpc.staff.rental.formOptions.queryOptions()).data;
  const companies = (opts?.companies ?? []).map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }));
  return (
    <FormDialog
      title="Add bill split"
      description="Bill part of this booking to a company (insurer, ICBC, body shop, corporate)."
      wide
      trigger={
        <Button size="sm" variant="outline">
          <PlusIcon /> Add
        </Button>
      }
      onSubmit={(v) =>
        onSubmit({
          companyId: v.companyId as string,
          claimType: v.claimType as BillSplitPayload["claimType"],
          insuranceCompany: str(v.insuranceCompany),
          policyNumber: str(v.policyNumber),
          policyExpiry: v.policyExpiry ? new Date(v.policyExpiry as string) : null,
          prePaid: Number(v.prePaid ?? 0),
          lumpSum: Number(v.lumpSum ?? 0),
          amountPerDay: Number(v.amountPerDay),
          numberOfDays: Number(v.numberOfDays),
          adjuster: str(v.adjuster),
          insured: str(v.insured),
          roNumber: str(v.roNumber),
          poNumber: str(v.poNumber),
          lossDate: v.lossDate ? new Date(v.lossDate as string) : null,
          claimNumber: str(v.claimNumber),
          maxPay: v.maxPay ? Number(v.maxPay) : null,
          percentCoPay: Number(v.percentCoPay ?? 0),
          payAllTaxes: Boolean(v.payAllTaxes),
          taxIds: (v.taxIds as string[]) ?? [],
          payTotal: Boolean(v.payTotal),
          deductFromCustomersBalance: Boolean(v.deductFromCustomersBalance),
          memo: str(v.memo),
        })
      }
    >
      <SelectField label="Company" name="companyId" required options={companies} />
      <SelectField label="Claim type" name="claimType" required options={CLAIM_TYPES} />
      <Field label="Insurance company" name="insuranceCompany" />
      <Field label="Policy number" name="policyNumber" />
      <Field label="Policy expiration" name="policyExpiry" type="date" />
      <Field label="Claim #" name="claimNumber" />
      <Field label="Pre-paid" name="prePaid" type="number" step="0.01" min="0" required defaultValue="0" />
      <Field label="Lump sum" name="lumpSum" type="number" step="0.01" min="0" required defaultValue="0" />
      <Field label="Amount / day" name="amountPerDay" type="number" step="0.01" min="0" required defaultValue="0" />
      <Field label="Number of days" name="numberOfDays" type="number" min="0" required defaultValue="0" />
      <Field label="Adjuster" name="adjuster" />
      <Field label="Insured" name="insured" />
      <Field label="RO#" name="roNumber" />
      <Field label="PO#" name="poNumber" />
      <Field label="Loss date" name="lossDate" type="date" />
      <Field label="Max pay" name="maxPay" type="number" step="0.01" min="0" />
      <SelectField label="% Co-pay" name="percentCoPay" placeholder={false} options={Array.from({ length: 101 }, (_, i) => String(i))} defaultValue="0" />
      <fieldset className="space-y-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Taxes paid by company</legend>
        <CheckField label="All" name="payAllTaxes" />
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(opts?.taxes ?? []).map((t) => (
            <CheckField
              key={t.id}
              name="taxIds"
              value={t.id}
              data-multi="1"
              label={`${t.name} (${t.kind === "PERCENT" ? `${Number(t.value)}%` : money(t.value)})`}
            />
          ))}
        </div>
      </fieldset>
      <CheckField label="Pay total" name="payTotal" />
      <CheckField label="Deduct from customer's balance" name="deductFromCustomersBalance" />
      <TextareaField label="Memo" name="memo" />
    </FormDialog>
  );
}

export type TransportPayload = {
  pickupLocationId?: string;
  pickupAddress?: string;
  pickupAt: Date | null;
  dropoffLocationId?: string;
  dropoffAddress?: string;
  dropoffAt: Date | null;
  pickupMemo?: string;
};

/** "Pickup/Drop-off": vehicle delivery to and collection from the renter. */
export function TransportDialog({ onSubmit }: { onSubmit: (p: TransportPayload) => Promise<unknown> }) {
  const trpc = useTRPC();
  const opts = useQuery(trpc.staff.rental.formOptions.queryOptions()).data;
  const locations = (opts?.locations ?? []).map((l) => ({ value: l.id, label: l.name }));
  return (
    <FormDialog
      title="Add pickup / drop-off"
      wide
      trigger={
        <Button size="sm" variant="outline">
          <PlusIcon /> Add
        </Button>
      }
      onSubmit={(v) =>
        onSubmit({
          pickupLocationId: str(v.pickupLocationId),
          pickupAddress: str(v.pickupAddress),
          pickupAt: v.pickupAt ? fromDateTimeLocal(v.pickupAt as string) : null,
          dropoffLocationId: str(v.dropoffLocationId),
          dropoffAddress: str(v.dropoffAddress),
          dropoffAt: v.dropoffAt ? fromDateTimeLocal(v.dropoffAt as string) : null,
          pickupMemo: str(v.pickupMemo),
        })
      }
    >
      <SelectField label="Pickup location" name="pickupLocationId" options={locations} placeholder="— Address below —" />
      <Field label="Pickup address" name="pickupAddress" />
      <Field label="Pickup date" name="pickupAt" type="datetime-local" full />
      <SelectField label="Drop-off location" name="dropoffLocationId" options={locations} placeholder="— Address below —" />
      <Field label="Drop-off address" name="dropoffAddress" />
      <Field label="Drop-off date" name="dropoffAt" type="datetime-local" full />
      <TextareaField label="Memo" name="pickupMemo" />
    </FormDialog>
  );
}
