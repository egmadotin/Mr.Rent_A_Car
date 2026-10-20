"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlusIcon, PencilIcon, PinIcon, PlusIcon } from "lucide-react";
import type { RouterOutputs, Wire } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { fullName, money, toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import {
  CheckField,
  Field,
  FormDialog,
  SelectField,
  TextareaField,
  errorMessage,
} from "../../../../../_components/form";
import { PageHeader } from "../../../../../_components/page-header";
import { BillSplitDialog, CLAIM_TYPES, TransportDialog } from "../../../../../_components/booking-dialogs";
import { NO_PERMISSION, useCan } from "../../../../../_components/permissions";
import { EmailDocumentDialog } from "../../../../../_components/email-document-dialog";
import { ActionLink, DL } from "../../../../../_components/legacy-view";
import { InspectionsPanel } from "../../../../../_components/inspections";
import { legacyDate } from "../../../../../_components/list-kit";
import { PrintChargeTable } from "../../../../print/_components/print-kit";
import { PaymentRowActions } from "../../../../../_components/payment-row-actions";
import { methodLabel, usePaymentMethods } from "../../../../../_components/payment-methods";

type Data = Wire<RouterOutputs["staff"]["reservation"]["byId"]>;
type DialogName = null | "start" | "cancel" | "delete" | "noshow" | "move" | "reinstate" | "email";
const FUEL = Array.from({ length: 17 }, (_, i) => ({ value: String(i), label: `${i}/16` }));

export function ReservationDetail({ reservationId, autoStartRental }: { reservationId: string; autoStartRental?: boolean }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.staff.reservation.byId.queryOptions({ reservationId }));
  const data = q.data as Data | undefined;
  const pm = usePaymentMethods(data?.reservation.pickupLocationId);
  const [dialog, setDialog] = React.useState<DialogName>(autoStartRental ? "start" : null);
  const can = useCan();
  const [panel, setPanel] = React.useState<null | "payments" | "drivers" | "billsplit" | "transports" | "inspection">(null);
  const close = (o: boolean) => !o && setDialog(null);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.staff.reservation.byId.queryKey({ reservationId }) }),
      qc.invalidateQueries({ queryKey: trpc.staff.reservation.list.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.staff.calendar.range.queryKey() }),
    ]);
  const run = async <T,>(p: Promise<T>) => {
    const res = await p;
    await refresh();
    return res;
  };

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading reservation…</div>;
  if (!data) return <div className="p-6 text-sm text-destructive">{q.error?.message ?? "Reservation not found."}</div>;

  const r = data.reservation;
  const active = r.status === "TENTATIVE" || r.status === "CONFIRMED";
  const popups = r.memos.filter((m) => m.showAsPopup);

  const tz = r.pickupLocation.timeZone;
  const status = r.status === "CHECKED_OUT" ? "Honored" : r.status.replace("_", " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase());
  // the RentCentric ReservationMain.aspx action links, two per row, in its order
  const links: React.ReactNode[] = [
    active ? (
      <ActionLink key="s" onClick={() => setDialog("start")} disabled={!can("CheckOuts")} title={NO_PERMISSION}>Start Rental</ActionLink>
    ) : r.rental ? (
      <ActionLink key="s" href={`/admin/rentals/${r.rental.id}`}>Rental #{r.rental.raNumber}</ActionLink>
    ) : (
      <ActionLink key="s" disabled>Start Rental</ActionLink>
    ),
    <ActionLink key="p" onClick={() => setPanel("payments")} active={panel === "payments"}>Payments/Charges ({r.payments.length})</ActionLink>,
    <ActionLink key="i" href={`/admin/print/reservations/${r.id}?t=${encodeURIComponent("Reservation Confirmation")}`} newTab>Print Invoice</ActionLink>,
    <ActionLink key="d" onClick={() => setPanel("drivers")} active={panel === "drivers"}>Additional Drivers ({r.drivers.length})</ActionLink>,
    <ActionLink key="pd" href={`/admin/print/reservations/${r.id}`} newTab>Print Reservation Detail</ActionLink>,
    <ActionLink key="b" onClick={() => setPanel("billsplit")} active={panel === "billsplit"}>Bill Split ({r.billSplits.length})</ActionLink>,
    active ? (
      <ActionLink key="c" onClick={() => setDialog("cancel")} disabled={!can("ReservationsDelete")} title={NO_PERMISSION}>Cancel Reservation</ActionLink>
    ) : r.status === "CANCELLED" || r.status === "NO_SHOW" ? (
      <ActionLink key="c" onClick={() => setDialog("reinstate")}>Reinstate Reservation</ActionLink>
    ) : (
      <ActionLink key="c" disabled>Cancel Reservation</ActionLink>
    ),
    <ActionLink key="m" onClick={() => setDialog("move")} disabled={!active}>Move Reservation</ActionLink>,
    <ActionLink key="del" onClick={() => setDialog("delete")} disabled={r.status === "CHECKED_OUT" || !can("ReservationsDeleteReal")} title={r.status === "CHECKED_OUT" ? undefined : NO_PERMISSION}>Delete Reservation</ActionLink>,
    <ActionLink
      key="dup"
      onClick={async () => {
        try {
          const { id } = await client.staff.reservation.duplicate.mutate({ reservationId });
          toast.success("Reservation duplicated");
          router.push(`/admin/reservations/${id}`);
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      Duplicate Reservation
    </ActionLink>,
    <ActionLink key="t" onClick={() => setPanel("transports")} active={panel === "transports"}>Pickup/Drop-off ({r.transports.length})</ActionLink>,
    <ActionLink key="e1" onClick={() => setDialog("email")}>E-Mail Reservation Details</ActionLink>,
    <ActionLink key="e2" onClick={() => setDialog("email")}>Email Reservation Form/Invoice</ActionLink>,
    <ActionLink key="ins" onClick={() => setPanel("inspection")} active={panel === "inspection"}>Reservation Inspection</ActionLink>,
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Reservations", href: "/admin/reservations" },
          ...(r.customer ? [{ label: fullName(r.customer), href: `/admin/customers/${r.customer.id}` }] : []),
          { label: `#${r.number}` },
        ]}
        title={`Reservation # ${r.number}`}
        actions={
          active ? (
            <Button variant="outline" asChild>
              <Link href={`/admin/reservations/${r.id}/edit`}><PencilIcon /> Edit</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {popups.map((m) => (
            <div key={m.id} role="note" className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
              <PinIcon className="mt-0.5 size-4 shrink-0" /> {m.body}
            </div>
          ))}

          {/* the fields of RentCentric ReservationMain.aspx, in its two columns */}
          <Card>
            <CardContent className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              <DL
                single
                items={[
                  ["Status:", status],
                  ["Type:", r.vehicleType.name],
                  ["Return Location:", r.returnLocation.name],
                  ["Entered By:", r.createdBy?.name ?? r.reservationChannel],
                  ["Reservation Date:", legacyDate(r.createdAt, { timeZone: tz })],
                  ["Reservation Channel:", r.reservationChannel],
                  ["Company:", r.company?.name ?? "N/A"],
                ]}
              />
              <DL
                single
                items={[
                  [
                    "Vehicle:",
                    r.vehicle ? (
                      <Link key="v" href={`/admin/vehicles/${r.vehicle.id}`} className="text-primary hover:underline">
                        {r.vehicle.assignedId} — {r.vehicle.year ?? ""} {r.vehicle.make.name} {r.vehicle.model.name}
                      </Link>
                    ) : (
                      "Not Selected"
                    ),
                  ],
                  ["Pickup Date:", legacyDate(r.pickupAt, { timeZone: tz })],
                  ["Pickup Location:", r.pickupLocation.name],
                  ["Return Date:", legacyDate(r.returnAt, { timeZone: tz })],
                  ["Flight Details:", [r.airline, r.flightNumber, r.arrivalAirport].filter(Boolean).join(", ")],
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {links.map((l, k) => (
                <div key={k}>{l}</div>
              ))}
            </CardContent>
          </Card>

          {panel === "payments" && (
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Payments/Charges</CardTitle>
                {active && (
                  <FormDialog
                    title="Add payment"
                    wide
                    trigger={<Button size="sm"><PlusIcon /> Add payment</Button>}
                    onSubmit={(x) =>
                      run(
                        client.staff.reservation.addPayment.mutate({
                          reservationId,
                          method: x.method as "CASH",
                          transactionType: x.transactionType as "PAYMENT",
                          amount: Number(x.amount),
                          authorizationCode: x.authorizationCode as string | undefined,
                          transactionCode: x.transactionCode as string | undefined,
                          takenAt: new Date(x.takenAt as string),
                        }),
                      )
                    }
                  >
                    <SelectField label="Payment Method" name="method" required options={pm.options} defaultValue={pm.defaultMethod ?? ""} />
                    <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required />
                    <SelectField
                      label="Transaction Type"
                      name="transactionType"
                      placeholder={false}
                      defaultValue="AUTHORIZATION"
                      options={[{ value: "PAYMENT", label: "Payment (Credit)" }, { value: "AUTHORIZATION", label: "Authorization" }, { value: "REFUND", label: "Refund" }]}
                    />
                    <Field label="Authorization Code" name="authorizationCode" />
                    <Field label="Transaction Code" name="transactionCode" />
                    <Field label="Date" name="takenAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
                  </FormDialog>
                )}
              </CardHeader>
              {r.payments.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No payments.</p>
              ) : (
                <Table>
                  <TableBody>
                    {r.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{legacyDate(p.takenAt, { timeZone: tz })}</TableCell>
                        <TableCell>{methodLabel(p)}</TableCell>
                        <TableCell>{p.transactionType === "PAYMENT" ? "Payment (Credit)" : p.transactionType === "REFUND" ? "Refund" : "Authorization"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                        <TableCell className="w-20"><PaymentRowActions p={p} onChanged={() => run(Promise.resolve())} locationId={r.pickupLocationId} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          {panel === "drivers" && <DriversCard data={data} run={run} />}
          {panel === "inspection" && <InspectionsPanel title="Reservation Inspection" reservationId={r.id} vehicleId={r.vehicleId} empty="There is no inspection for this reservation !" />}

          {panel === "billsplit" && (
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Bill Split</CardTitle>
                {active && <BillSplitDialog onSubmit={(p) => run(client.staff.reservation.addBillSplit.mutate({ reservationId, ...p }))} />}
              </CardHeader>
              {r.billSplits.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">Not split. The renter pays the full amount.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Company</TableHead><TableHead>Type</TableHead><TableHead className="text-right">/ day</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.billSplits.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.company.name}</TableCell>
                        <TableCell>{CLAIM_TYPES.find((c) => c.value === b.claimType)?.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(b.amountPerDay)}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.numberOfDays}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(Number(b.amountPerDay) * b.numberOfDays + Number(b.lumpSum))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          {panel === "transports" && (
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Pickup/Drop-off</CardTitle>
                {active && <TransportDialog onSubmit={(p) => run(client.staff.reservation.addTransport.mutate({ reservationId, ...p }))} />}
              </CardHeader>
              {r.transports.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No delivery or collection booked.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Pickup location</TableHead><TableHead>Pickup date</TableHead><TableHead>Drop-off location</TableHead><TableHead>Drop-off date</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.transports.map((x) => (
                      <TableRow key={x.id}>
                        <TableCell>{x.pickupLocation?.name ?? x.pickupAddress ?? "—"}</TableCell>
                        <TableCell>{legacyDate(x.pickupAt, { timeZone: tz })}</TableCell>
                        <TableCell>{x.dropoffLocation?.name ?? x.dropoffAddress ?? "—"}</TableCell>
                        <TableCell>{legacyDate(x.dropoffAt, { timeZone: tz })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          <Card className="gap-2 pb-0">
            <CardHeader className="items-center">
              <CardTitle>Memo</CardTitle>
              <FormDialog
                title="Add memo"
                trigger={<Button size="sm" variant="outline"><MessageSquarePlusIcon /> Add memo</Button>}
                onSubmit={(x) => run(client.staff.reservation.addMemo.mutate({ reservationId, body: x.body as string, showAsPopup: Boolean(x.showAsPopup) }))}
              >
                <TextareaField label="Memo" name="body" required rows={4} />
                <CheckField label="Always display this memo as a popup for system users" name="showAsPopup" />
              </FormDialog>
            </CardHeader>
            {r.memos.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No memos.</p>
            ) : (
              <ul className="divide-y">
                {r.memos.map((m) => (
                  <li key={m.id} className="space-y-1 px-4 py-3 text-sm">
                    <div className="text-xs text-muted-foreground">{m.author?.name ?? "System"} · {legacyDate(m.createdAt, { timeZone: tz })}</div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* charges, as on ReservationMain.aspx: … Total, Total Payments, Balance */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <PrintChargeTable lines={r.chargeLines} payments={r.payments} timeLabel="Total T&KM" />
        </div>
      </div>

      {dialog === "start" && <StartRentalDialog data={data} onOpenChange={close} />}
      <EmailDocumentDialog
        open={dialog === "email"}
        onOpenChange={close}
        kind="RESERVATION"
        id={r.id}
        locationId={r.pickupLocationId}
        defaultTo={r.email ?? r.customer?.email}
        defaultSubject={`Reservation Confirmation #${r.number} — Mr Rent A Car`}
        title="Email Reservation"
        onSent={() => void q.refetch()}
      />
      {dialog === "move" && <MoveDialog reservationId={reservationId} onOpenChange={close} run={run} />}

      <ConfirmAction
        open={dialog === "cancel"}
        onOpenChange={close}
        destructive
        title="Cancel reservation"
        description={<>Reservation #{r.number} will be cancelled and its vehicle released. You can reinstate it later.</>}
        reasonLabel="Reason (saved to memo history)"
        confirmLabel="Cancel reservation"
        onConfirm={(reason) => run(client.staff.reservation.setStatus.mutate({ reservationId, status: "CANCELLED", reason }))}
      />
      <ConfirmAction
        open={dialog === "noshow"}
        onOpenChange={close}
        destructive
        title="Mark as no-show"
        description="The renter didn't pick up. The vehicle is released."
        confirmLabel="Mark no-show"
        onConfirm={() => run(client.staff.reservation.setStatus.mutate({ reservationId, status: "NO_SHOW" }))}
      />
      <ConfirmAction
        open={dialog === "reinstate"}
        onOpenChange={close}
        title="Reinstate reservation"
        description="The reservation goes back to Tentative. If its vehicle has been booked since, this will be refused."
        confirmLabel="Reinstate"
        onConfirm={() => run(client.staff.reservation.setStatus.mutate({ reservationId, status: "TENTATIVE" }))}
      />
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={close}
        destructive
        title="Delete reservation"
        description={<>Reservation #{r.number} is removed from all lists and reports. Prefer <b>Cancel</b> unless it was created by mistake.</>}
        requireText={String(r.number)}
        confirmLabel="Delete reservation"
        onConfirm={async () => {
          await run(client.staff.reservation.delete.mutate({ reservationId, confirmNumber: r.number }));
          router.push("/admin/reservations");
        }}
      />
    </>
  );
}

function StartRentalDialog({ data, onOpenChange }: { data: Data; onOpenChange: (o: boolean) => void }) {
  const r = data.reservation;
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const vehicles = useQuery(
    trpc.staff.reservation.availableVehicles.queryOptions({
      vehicleTypeId: r.vehicleTypeId,
      locationId: r.pickupLocationId,
      pickupAt: new Date(r.pickupAt),
      returnAt: new Date(r.returnAt),
      excludeReservationId: r.id,
    }),
  ).data;
  const options = (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.assignedId} — ${v.year ?? ""} ${v.make.name} ${v.model.name}` }));
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Start rental"
      description={`Open a rental agreement for ${r.firstName} ${r.lastName}. Charges and payments carry over from the reservation.`}
      submitLabel="Start rental"
      wide
      onSubmit={async (v) => {
        const { rentalId } = await client.staff.reservation.startRental.mutate({
          reservationId: r.id,
          vehicleId: v.vehicleId as string,
          checkOutAt: fromDateTimeLocal(v.checkOutAt as string),
          odometerOut: Number(v.odometerOut),
          fuelOut: Number(v.fuelOut),
          checkOutChannel: v.checkOutChannel as string | undefined,
        });
        router.push(`/admin/rentals/${rentalId}`);
      }}
    >
      <SelectField label="Vehicle" name="vehicleId" required full defaultValue={r.vehicleId ?? ""} options={options} hint={`${r.vehicleType.name} vehicles free for these dates at ${r.pickupLocation.name}.`} />
      <Field label="Check-out date & time" name="checkOutAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
      <Field label="Odometer out" name="odometerOut" type="number" min={0} required defaultValue={r.vehicle?.currentOdometer ?? ""} />
      <SelectField label="Fuel out" name="fuelOut" options={FUEL} defaultValue={String(r.vehicle?.fuelLevel ?? 16)} placeholder={false} />
      <Field label="Check-out channel" name="checkOutChannel" placeholder="e.g. Counter" />
    </FormDialog>
  );
}

function DriversCard({ data, run }: { data: Data; run: <T>(p: Promise<T>) => Promise<T> }) {
  const r = data.reservation;
  const trpc = useTRPC();
  const client = useTRPCClient();
  const [q, setQ] = React.useState("");
  const results = useQuery({ ...trpc.staff.rental.searchDrivers.queryOptions({ q }), enabled: q.trim().length >= 2 });
  const [removing, setRemoving] = React.useState<string | null>(null);
  const existing = new Set([r.customerId, ...r.drivers.map((d) => d.customerId)]);
  return (
    <Card>
      <CardHeader><CardTitle>Additional drivers</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {r.drivers.length === 0 && <p className="text-sm text-muted-foreground">No additional drivers.</p>}
        <ul className="divide-y rounded-md border empty:hidden">
          {r.drivers.map((d) => (
            <li key={d.id} className="flex items-center justify-between p-2 text-sm">
              <span>{fullName(d.customer)} <span className="text-muted-foreground">· Lic {d.customer.licenseNumber ?? "—"}</span></span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(d.id)}>Remove</Button>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers to add as a driver…" aria-label="Search customers" className="max-w-md" />
          <ul className="max-w-md divide-y rounded-md border empty:hidden">
            {results.data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-2 text-sm">
                <span>{fullName(c)} {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}</span>
                <Button
                  size="sm"
                  disabled={existing.has(c.id) || c.isUndesired}
                  onClick={() => run(client.staff.reservation.addDriver.mutate({ reservationId: r.id, customerId: c.id })).then(() => setQ(""), (e) => toast.error(errorMessage(e)))}
                >
                  {existing.has(c.id) ? "Added" : "Add"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <ConfirmAction
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        title="Remove driver"
        description="Remove this additional driver from the reservation?"
        confirmLabel="Remove"
        onConfirm={() => run(client.staff.reservation.removeDriver.mutate({ bookingDriverId: removing! }))}
      />
    </Card>
  );
}

function MoveDialog({ reservationId, onOpenChange, run }: { reservationId: string; onOpenChange: (o: boolean) => void; run: <T>(p: Promise<T>) => Promise<T> }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const [q, setQ] = React.useState("");
  const results = useQuery({ ...trpc.staff.rental.searchDrivers.queryOptions({ q }), enabled: q.trim().length >= 2 });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
      <DialogHeader>
        <DialogTitle>Move to another customer</DialogTitle>
        <DialogDescription>The reservation keeps its dates, vehicle and charges; only the renter changes.</DialogDescription>
      </DialogHeader>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" aria-label="Search customers" autoFocus />
      <ul className="max-h-64 divide-y overflow-y-auto rounded-md border empty:hidden">
        {results.data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-2 text-sm">
            <span>{fullName(c)} <span className="text-muted-foreground">· Lic {c.licenseNumber ?? "—"}</span></span>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                run(client.staff.reservation.moveToCustomer.mutate({ reservationId, customerId: c.id })).then(
                  () => {
                    toast.success(`Moved to ${fullName(c)}`);
                    onOpenChange(false);
                  },
                  (e) => toast.error(errorMessage(e)),
                )
              }
            >
              Move here
            </Button>
          </li>
        ))}
      </ul>
      </DialogContent>
    </Dialog>
  );
}
