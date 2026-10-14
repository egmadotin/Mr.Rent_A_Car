"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, money, toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, PAYMENT_METHOD_OPTIONS, SelectField, TextareaField } from "../../../../../_components/form";
import { Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";

const CLAIM_TYPE_LABEL: Record<string, string> = { RENTER: "Renter", THIRD_PARTY: "3rd Party", OTHER: "Other" };
const str = (v: unknown) => (v as string | undefined) || undefined;

export function ClaimsTab({ data }: { data: RentalData }) {
  const r = data.rental;
  const { api, run } = useRentalActions(r.id);
  const [removeTicket, setRemoveTicket] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <Section
        title="Traffic tickets"
        count={r.trafficTickets.length}
        flush
        action={
          <FormDialog
            title="Add traffic ticket"
            description="The ticket total is added to the rental's charges."
            wide
            trigger={
              <Button size="sm" variant="outline">
                <PlusIcon /> Add ticket
              </Button>
            }
            onSubmit={(v) =>
              run(
                api.addTrafficTicket.mutate({
                  rentalId: r.id,
                  ticketDate: fromDateTimeLocal(v.ticketDate as string),
                  offense: v.offense as string,
                  location: str(v.location),
                  amount: Number(v.amount),
                  officer: str(v.officer),
                  city: str(v.city),
                  province: str(v.province),
                  country: str(v.country),
                  payMethod: (str(v.payMethod) as "CASH" | undefined) ?? null,
                  isPaid: Boolean(v.isPaid),
                  memo: str(v.memo),
                }),
              )
            }
          >
            <Field label="Ticket date" name="ticketDate" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
            <Field label="Amount" name="amount" type="number" step="0.01" min="0" required />
            <Field label="Offense" name="offense" required full />
            <Field label="Location" name="location" />
            <Field label="Officer" name="officer" />
            <Field label="City" name="city" />
            <Field label="Province / state" name="province" />
            <Field label="Country" name="country" />
            <SelectField label="Pay method" name="payMethod" options={PAYMENT_METHOD_OPTIONS} placeholder="— Not paid yet —" />
            <CheckField label="Paid" name="isPaid" />
            <TextareaField label="Memo" name="memo" />
          </FormDialog>
        }
      >
        {r.trafficTickets.length === 0 ? (
          <Empty>No traffic tickets.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Offense</TableHead>
                <TableHead>Where</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.trafficTickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{date(t.ticketDate)}</TableCell>
                  <TableCell>{t.offense}</TableCell>
                  <TableCell className="text-muted-foreground">{[t.location, t.city, t.province].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell>{t.isPaid ? <Badge variant="success">Paid</Badge> : <Badge variant="muted">Unpaid</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.amount)}</TableCell>
                  <TableCell>
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete ticket" onClick={() => setRemoveTicket(t.id)}>
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ConfirmAction
          open={removeTicket !== null}
          onOpenChange={(o) => !o && setRemoveTicket(null)}
          destructive
          title="Delete traffic ticket"
          description="The ticket is removed and the Traffic Tickets charge is recalculated."
          confirmLabel="Delete ticket"
          onConfirm={() => run(api.removeTrafficTicket.mutate({ ticketId: removeTicket! }))}
        />
      </Section>

      <Section
        title="Claims"
        count={r.claims.length}
        flush
        action={
          <FormDialog
            title="New claim"
            wide
            trigger={
              <Button size="sm" variant="outline">
                <PlusIcon /> New claim
              </Button>
            }
            onSubmit={(v) =>
              run(
                api.addClaim.mutate({
                  rentalId: r.id,
                  claimDate: new Date(v.claimDate as string),
                  claimNumber: str(v.claimNumber),
                  closeDate: v.closeDate ? new Date(v.closeDate as string) : null,
                  type: v.type as "RENTER",
                  location: str(v.location),
                  policeDept: str(v.policeDept),
                  policeRep: str(v.policeRep),
                  status: v.status as "OPEN",
                  deductible: v.deductible ? Number(v.deductible) : null,
                  totalPayments: v.totalPayments ? Number(v.totalPayments) : null,
                  memo: str(v.memo),
                  hasAccidentReport: Boolean(v.hasAccidentReport),
                  hasRenterInsurancePolicy: Boolean(v.hasRenterInsurancePolicy),
                  hasPoliceReport: Boolean(v.hasPoliceReport),
                  hasRentalAgreement: Boolean(v.hasRentalAgreement),
                }),
              )
            }
          >
            <Field label="Claim date" name="claimDate" type="date" required />
            <Field label="Claim #" name="claimNumber" />
            <SelectField label="Claim type" name="type" required placeholder={false} options={Object.entries(CLAIM_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
            <SelectField label="Status" name="status" required placeholder={false} options={[{ value: "OPEN", label: "Open" }, { value: "PENDING", label: "Pending" }, { value: "CLOSED", label: "Closed" }]} />
            <Field label="Location" name="location" />
            <Field label="Claim close date" name="closeDate" type="date" />
            <Field label="Police dept." name="policeDept" />
            <Field label="Police rep." name="policeRep" />
            <Field label="Deductible" name="deductible" type="number" step="0.01" min="0" />
            <Field label="Total payments" name="totalPayments" type="number" step="0.01" min="0" />
            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Documents on file</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <CheckField label="Accident report" name="hasAccidentReport" />
                <CheckField label="Renter insurance policy" name="hasRenterInsurancePolicy" />
                <CheckField label="Police report" name="hasPoliceReport" />
                <CheckField label="Rental agreement" name="hasRentalAgreement" />
              </div>
            </fieldset>
            <TextareaField label="Memo" name="memo" />
          </FormDialog>
        }
      >
        {r.claims.length === 0 ? (
          <Empty>No claims.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Claim date</TableHead>
                <TableHead>Close date</TableHead>
                <TableHead className="text-right">Deductible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.claims.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.claimNumber ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "CLOSED" ? "muted" : c.status === "PENDING" ? "warning" : "info"}>{c.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell>{CLAIM_TYPE_LABEL[c.type]}</TableCell>
                  <TableCell>{date(c.claimDate)}</TableCell>
                  <TableCell>{date(c.closeDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(c.deductible)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
