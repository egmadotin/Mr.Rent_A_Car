"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, dateTime, money, toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { Field, FormDialog, PAYMENT_METHOD_OPTIONS, SelectField } from "../../../../../_components/form";
import { BillSplitDialog, CLAIM_TYPES } from "../../../../../_components/booking-dialogs";
import { PaymentRowActions } from "../../../../../_components/payment-row-actions";
import { useCan } from "../../../../../_components/permissions";
import { RowActions } from "../../../../../_components/row-actions";
import { Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";


export function BillingTab({ data, show }: { data: RentalData; show?: string }) {
  const on = (k: string) => !show || show === k;
  const r = data.rental;
  const trpc = useTRPC();
  const opts = useQuery(trpc.staff.rental.formOptions.queryOptions()).data;
  const { api, run } = useRentalActions(r.id);
  const can = useCan();
  const refresh = () => run(Promise.resolve());
  const [removeSplit, setRemoveSplit] = React.useState<string | null>(null);
  const companies = (opts?.companies ?? []).map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }));

  return (
    <div className={show ? "space-y-4" : "grid gap-4 xl:grid-cols-2"}>
      {/* Payments/Charges */}
      {on("payments") && (
        <Section
          title="Payments"
          count={r.payments.length}
          flush
          className="xl:col-span-2"
          action={
            <FormDialog
              title="Add payment"
              wide
              trigger={
                <Button size="sm">
                  <PlusIcon /> Add payment
                </Button>
              }
              onSubmit={(v) =>
                run(
                  api.addPayment.mutate({
                    rentalId: r.id,
                    method: v.method as "CASH",
                    transactionType: v.transactionType as "PAYMENT",
                    amount: Number(v.amount),
                    authorizationCode: v.authorizationCode as string | undefined,
                    transactionCode: v.transactionCode as string | undefined,
                    cardLast4: v.cardLast4 as string | undefined,
                    takenAt: fromDateTimeLocal(v.takenAt as string),
                    paymentDetail: v.paymentDetail as string | undefined,
                    paymentDetailCont: v.paymentDetailCont as string | undefined,
                    companyId: v.companyId as string | undefined,
                  }),
                )
              }
            >
              <SelectField label="Payment method" name="method" required options={PAYMENT_METHOD_OPTIONS} />
              <SelectField
                label="Transaction type"
                name="transactionType"
                required
                placeholder={false}
                options={[
                  { value: "PAYMENT", label: "Payment (Credit)" },
                  { value: "AUTHORIZATION", label: "Authorization" },
                  { value: "REFUND", label: "Refund (Credit)" },
                ]}
              />
              <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required />
              <Field label="Card last 4" name="cardLast4" inputMode="numeric" pattern="\d{4}" maxLength={4} hint="Card payments only. Never enter the full number." />
              <Field label="Authorization code" name="authorizationCode" />
              <Field label="Transaction code" name="transactionCode" />
              <Field label="Date" name="takenAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
              <SelectField label="Paid by company" name="companyId" options={companies} placeholder="— None (renter) —" />
              <Field label="Payment detail" name="paymentDetail" />
              <Field label="Payment detail cont." name="paymentDetailCont" />
            </FormDialog>
          }
        >
          {r.payments.length === 0 ? (
            <Empty>No payments yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Auth / Txn</TableHead>
                  <TableHead>Paid by</TableHead>
                  <TableHead>Taken by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{dateTime(p.takenAt)}</TableCell>
                    <TableCell>
                      {p.method}
                      {p.cardLast4 && <span className="text-muted-foreground"> ···· {p.cardLast4}</span>}
                    </TableCell>
                    <TableCell>
                      {p.transactionType === "PAYMENT" && <Badge variant="success">Payment</Badge>}
                      {p.transactionType === "AUTHORIZATION" && <Badge variant="info">Authorization</Badge>}
                      {p.transactionType === "REFUND" && <Badge variant="warning">Refund</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{[p.authorizationCode, p.transactionCode].filter(Boolean).join(" / ") || "—"}</TableCell>
                    <TableCell>{p.company?.name ?? "Renter"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.takenBy?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                    <TableCell><PaymentRowActions p={p} onChanged={refresh} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}

      {/* Bill Split */}
      {on("billsplit") && (
        <Section
          title="Bill split"
          count={r.billSplits.length}
          flush
          action={
            <BillSplitDialog onSubmit={(p) => run(api.addBillSplit.mutate({ rentalId: r.id, ...p }))} />
          }
        >
          {r.billSplits.length === 0 ? (
            <Empty>Not split. The renter pays the full amount.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">/ day</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.billSplits.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.company.name}
                      {b.company.code && <span className="text-muted-foreground"> ({b.company.code})</span>}
                    </TableCell>
                    <TableCell>{CLAIM_TYPES.find((c) => c.value === b.claimType)?.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(b.amountPerDay)}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.numberOfDays}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(Number(b.amountPerDay) * b.numberOfDays + Number(b.lumpSum))}</TableCell>
                    <TableCell>
                      <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Remove bill split" onClick={() => setRemoveSplit(b.id)}>
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <ConfirmAction
            open={removeSplit !== null}
            onOpenChange={(o) => !o && setRemoveSplit(null)}
            destructive
            title="Remove bill split"
            description="The company's portion goes back to the renter's balance."
            confirmLabel="Remove"
            onConfirm={() => run(api.removeBillSplit.mutate({ billSplitId: removeSplit! }))}
          />
        </Section>
      )}

      {/* Commissions */}
      {on("commissions") && (
        <Section
          title="Commissions"
          count={r.commissions.length}
          flush
          action={
            <FormDialog
              title="New commission"
              trigger={
                <Button size="sm" variant="outline">
                  <PlusIcon /> Add
                </Button>
              }
              onSubmit={(v) =>
                run(
                  api.addCommission.mutate({
                    rentalId: r.id,
                    amount: Number(v.amount),
                    referralId: v.referralId as string | undefined,
                    userId: v.userId as string | undefined,
                  }),
                )
              }
            >
              <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required />
              <SelectField label="Referral" name="referralId" options={(opts?.referrals ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="— None —" />
              <SelectField label="…or staff member" name="userId" options={(opts?.staff ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="— None —" />
            </FormDialog>
          }
        >
          {r.commissions.length === 0 ? (
            <Empty>No commissions.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referral / user</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Entered</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.referral?.name ?? c.user?.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {date(c.enteredAt)} · {c.enteredBy?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        label={`commission of ${money(c.amount)}`}
                        canEdit={can("CommissionsEdit")}
                        canDelete={can("CommissionsDelete")}
                        editTitle="Edit commission"
                        onSave={(v) => run(api.updateCommission.mutate({ commissionId: c.id, amount: Number(v.amount), referralId: v.referralId as string | undefined, userId: v.userId as string | undefined }))}
                        onDelete={() => run(api.deleteCommission.mutate({ commissionId: c.id }))}
                      >
                        <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required defaultValue={Number(c.amount).toFixed(2)} />
                        <SelectField label="Referral" name="referralId" options={(opts?.referrals ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="— None —" defaultValue={c.referralId ?? ""} />
                        <SelectField label="…or staff member" name="userId" options={(opts?.staff ?? []).map((x) => ({ value: x.id, label: x.name }))} placeholder="— None —" defaultValue={c.userId ?? ""} />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}

      {/* Invoices (long-term rentals) */}
      {on("invoices") && (
        <Section
          title="Invoices"
          count={r.invoices.length}
          flush
          className="xl:col-span-2"
          action={
            <FormDialog
              title="Add credit invoice"
              trigger={
                <Button size="sm" variant="outline">
                  <PlusIcon /> Credit invoice
                </Button>
              }
              onSubmit={(v) =>
                run(
                  api.addCreditInvoice.mutate({
                    rentalId: r.id,
                    beginDate: new Date(v.beginDate as string),
                    endDate: new Date(v.endDate as string),
                    numberOfDays: Number(v.numberOfDays),
                    amount: Number(v.amount),
                  }),
                )
              }
            >
              <Field label="Begin date" name="beginDate" type="date" required />
              <Field label="End date" name="endDate" type="date" required />
              <Field label="Number of days" name="numberOfDays" type="number" min="0" required />
              <Field label="Credit amount" name="amount" type="number" step="0.01" min="0.01" required />
            </FormDialog>
          }
        >
          {r.invoices.length === 0 ? (
            <Empty>No invoices. Periodic invoices are used for long-term rentals.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Begin</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.invoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.invoiceNumber}</TableCell>
                    <TableCell className="text-right">{i.numberOfDays}</TableCell>
                    <TableCell>{date(i.beginDate)}</TableCell>
                    <TableCell>{date(i.endDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(i.amount)}</TableCell>
                    <TableCell>{i.isCredit ? "Yes" : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}
    </div>
  );
}
