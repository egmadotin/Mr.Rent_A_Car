"use client";

import { useTRPCClient } from "@mrac/api/client";
import { fromDateTimeLocal, toDateTimeLocal } from "@mrac/ui/lib/format";
import { Field, SelectField } from "./form";
import { useCan } from "./permissions";
import { RowActions } from "./row-actions";
import { methodLabel, methodValue, usePaymentMethods } from "./payment-methods";

type P = { id: string; method: string; methodName?: string | null; transactionType: string; amount: string | number; authorizationCode: string | null; transactionCode: string | null; takenAt: string | Date };

/** Edit / Delete on a payment row (rental or reservation): RentCentric "Edit Transactions" / "Delete Transactions". */
export function PaymentRowActions({ p, onChanged, locationId }: { p: P; onChanged: () => Promise<unknown>; locationId?: string | null }) {
  const client = useTRPCClient();
  const can = useCan();
  const pm = usePaymentMethods(locationId);
  return (
    <RowActions
      label={`${methodLabel(p)} ${p.transactionType.toLowerCase()} of $${Number(p.amount).toFixed(2)}`}
      canEdit={can("TransactionsEdit")}
      canDelete={can("TransactionsDelete")}
      editTitle="Edit payment"
      wide
      onSave={async (v) => {
        await client.staff.rental.updatePayment.mutate({
          paymentId: p.id,
          method: v.method as "CASH",
          transactionType: v.transactionType as "PAYMENT",
          amount: Number(v.amount),
          authorizationCode: v.authorizationCode as string | undefined,
          transactionCode: v.transactionCode as string | undefined,
          takenAt: fromDateTimeLocal(v.takenAt as string),
        });
        await onChanged();
      }}
      onDelete={async () => {
        await client.staff.rental.deletePayment.mutate({ paymentId: p.id });
        await onChanged();
      }}
    >
      <SelectField label="Payment method" name="method" required options={pm.options.some((o) => o.value === methodValue(p)) ? pm.options : [...pm.options, { value: methodValue(p), label: methodLabel(p) }]} defaultValue={methodValue(p)} />
      <SelectField
        label="Transaction type"
        name="transactionType"
        required
        placeholder={false}
        defaultValue={p.transactionType}
        options={[
          { value: "PAYMENT", label: "Payment (Credit)" },
          { value: "AUTHORIZATION", label: "Authorization" },
          { value: "REFUND", label: "Refund (Credit)" },
        ]}
      />
      <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required defaultValue={Number(p.amount).toFixed(2)} />
      <Field label="Date" name="takenAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date(p.takenAt))} />
      <Field label="Authorization code" name="authorizationCode" defaultValue={p.authorizationCode ?? ""} />
      <Field label="Transaction code" name="transactionCode" defaultValue={p.transactionCode ?? ""} />
    </RowActions>
  );
}
