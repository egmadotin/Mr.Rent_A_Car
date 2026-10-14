"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BanIcon,
  CheckCircle2Icon,
  CopyIcon,
  KeyRoundIcon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserCogIcon,
  UserXIcon,
} from "lucide-react";
import type { RouterOutputs, Wire } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mrac/ui/components/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { date, dateTime, fullName, money, toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, PAYMENT_METHOD_OPTIONS, SelectField, TextareaField, errorMessage } from "../../../../../_components/form";
import { PageHeader } from "../../../../../_components/page-header";
import { ReservationStatusBadge } from "../../status";
import { BillSplitDialog, CLAIM_TYPES, TransportDialog } from "../../../../../_components/booking-dialogs";

type Data = Wire<RouterOutputs["staff"]["reservation"]["byId"]>;
type DialogName = null | "start" | "cancel" | "delete" | "noshow" | "move" | "reinstate";
const FUEL = Array.from({ length: 17 }, (_, i) => ({ value: String(i), label: `${i}/16` }));

export function ReservationDetail({ reservationId, autoStartRental }: { reservationId: string; autoStartRental?: boolean }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery(trpc.staff.reservation.byId.queryOptions({ reservationId }));
  const data = q.data as Data | undefined;
  const [dialog, setDialog] = React.useState<DialogName>(autoStartRental ? "start" : null);
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
  const t = data.totals;
  const active = r.status === "TENTATIVE" || r.status === "CONFIRMED";
  const popups = r.memos.filter((m) => m.showAsPopup);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Reservations", href: "/admin/reservations" }, { label: `#${r.number}` }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Reservation #{r.number} <ReservationStatusBadge status={r.status} />
            {r.pickupLocationId !== r.returnLocationId && <Badge variant="info">One way</Badge>}
          </span>
        }
        description={`${r.firstName} ${r.lastName} · ${r.vehicleType.name}${r.vehicle ? ` · ${r.vehicle.assignedId}` : " · vehicle unassigned"} · ${dateTime(r.pickupAt)} → ${dateTime(r.returnAt)}`}
        actions={
          <>
            {active && (
              <Button onClick={() => setDialog("start")}>
                <KeyRoundIcon /> Start rental
              </Button>
            )}
            {r.status === "TENTATIVE" && (
              <Button variant="outline" onClick={() => run(client.staff.reservation.setStatus.mutate({ reservationId, status: "CONFIRMED" })).then(() => toast.success("Reservation confirmed"), (e) => toast.error(errorMessage(e)))}>
                <CheckCircle2Icon /> Confirm
              </Button>
            )}
            {active && (
              <Button variant="outline" asChild>
                <Link href={`/admin/reservations/${r.id}/edit`}><PencilIcon /> Edit</Link>
              </Button>
            )}
            {r.rental && (
              <Button asChild>
                <Link href={`/admin/rentals/${r.rental.id}`}><KeyRoundIcon /> Rental #{r.rental.raNumber}</Link>
              </Button>
            )}
            {(r.status === "CANCELLED" || r.status === "NO_SHOW") && (
              <Button variant="outline" onClick={() => setDialog("reinstate")}><RotateCcwIcon /> Reinstate</Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/admin/print/reservations/${r.id}`} target="_blank"><PrinterIcon /> Print</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontalIcon /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      const { id } = await client.staff.reservation.duplicate.mutate({ reservationId });
                      toast.success("Reservation duplicated");
                      router.push(`/admin/reservations/${id}`);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  <CopyIcon /> Duplicate reservation
                </DropdownMenuItem>
                {active && <DropdownMenuItem onSelect={() => setDialog("move")}><UserCogIcon /> Move to another customer</DropdownMenuItem>}
                {r.quote && <DropdownMenuItem asChild><Link href={`/admin/quotes/${r.quote.id}`}>From quote #{r.quote.number}</Link></DropdownMenuItem>}
                {active && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialog("noshow")}><UserXIcon /> Mark no-show…</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}><BanIcon /> Cancel reservation…</DropdownMenuItem>
                  </>
                )}
                {r.status !== "CHECKED_OUT" && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}><Trash2Icon /> Delete reservation…</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {popups.map((m) => (
          <div key={m.id} role="note" className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            <PinIcon className="mt-0.5 size-4 shrink-0" /> {m.body}
          </div>
        ))}

        <dl className="grid grid-cols-3 overflow-hidden rounded-lg border bg-card">
          {([["Total", t.total], ["Payments", t.totalPayments], ["Balance", t.balance]] as const).map(([label, val]) => (
            <div key={label} className="border-r px-4 py-3 last:border-r-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{money(val)}</dd>
            </div>
          ))}
        </dl>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charges">Charges & payments {r.payments.length > 0 && <Badge variant="muted" className="px-1.5">{r.payments.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="billsplit">Bill split {r.billSplits.length > 0 && <Badge variant="muted" className="px-1.5">{r.billSplits.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="drivers">Additional drivers {r.drivers.length > 0 && <Badge variant="muted" className="px-1.5">{r.drivers.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="notes">Memo {r.memos.length > 0 && <Badge variant="muted" className="px-1.5">{r.memos.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="activity">Activity log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader><CardTitle>Reservation details</CardTitle></CardHeader>
                <CardContent>
                  <DL
                    items={[
                      ["Booking location", r.location.name],
                      ["Vehicle type", r.vehicleType.name],
                      ["Pickup", `${dateTime(r.pickupAt)} · ${r.pickupLocation.name}`],
                      ["Return", `${dateTime(r.returnAt)} · ${r.returnLocation.name}`],
                      ["Vehicle", r.vehicle ? `${r.vehicle.assignedId} — ${r.vehicle.year ?? ""} ${r.vehicle.make.name} ${r.vehicle.model.name}` : "Unassigned"],
                      ["Rate", r.rate?.code],
                      ["Company", r.company?.name],
                      ["Discount", r.discountType ? `${r.discountType === "PERCENT" ? `${r.discountValue}%` : money(r.discountValue)}${r.discountReason ? ` · ${r.discountReason.name}` : ""}` : null],
                      ["Deposit", r.deposit ? money(r.deposit) : null],
                      ["Referral", r.referral?.name],
                      ["Delivery address", r.deliveryAddress],
                      ["Airline / flight", [r.airline, r.flightNumber].filter(Boolean).join(" ")],
                      ["Hotel", r.hotel],
                      ["Arrival airport", r.arrivalAirport],
                      ["Preferred language", r.preferredLanguage],
                      ["PO# / RO#", [r.poNumber, r.roNumber].filter(Boolean).join(" / ")],
                      ["Customer notes", r.customerNotes],
                      ["Flags", [r.isLoaner && "Loaner", r.isNonRevenue && "Non-revenue"].filter(Boolean).join(", ")],
                      ["Entered", `${dateTime(r.createdAt)} · ${r.createdBy?.name ?? "—"}`],
                      ["Reservation channel", r.reservationChannel],
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Renter</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {r.customer ? (
                    <Link href={`/admin/customers/${r.customer.id}`} className="text-base font-medium text-primary hover:underline">{fullName(r.customer)}</Link>
                  ) : (
                    <div className="text-base font-medium">{r.firstName} {r.lastName} <Badge variant="muted">Not saved as customer</Badge></div>
                  )}
                  {r.customer?.isUndesired && <Badge variant="destructive">Undesired</Badge>}
                  <DL
                    items={[
                      ["Phone", r.phone],
                      ["Email", r.email],
                      ["Licence #", r.customer?.licenseNumber],
                      ["Licence exp.", r.customer ? date(r.customer.licenseExpiry) : null],
                      ["Date of birth", r.customer ? date(r.customer.birthDate) : null],
                    ]}
                    single
                  />
                </CardContent>
              </Card>
              <Card className="gap-2 pb-0 xl:col-span-3">
                <CardHeader className="items-center">
                  <CardTitle>Pickup / drop-off <span className="font-normal text-muted-foreground">({r.transports.length})</span></CardTitle>
                  {active && <TransportDialog onSubmit={(p) => run(client.staff.reservation.addTransport.mutate({ reservationId, ...p }))} />}
                </CardHeader>
                {r.transports.length === 0 ? (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">No delivery or collection booked.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Pickup location</TableHead><TableHead>Pickup date</TableHead><TableHead>Drop-off location</TableHead><TableHead>Drop-off date</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {r.transports.map((x) => (
                        <TableRow key={x.id}>
                          <TableCell>{x.pickupLocation?.name ?? x.pickupAddress ?? "—"}</TableCell>
                          <TableCell>{dateTime(x.pickupAt)}</TableCell>
                          <TableCell>{x.dropoffLocation?.name ?? x.dropoffAddress ?? "—"}</TableCell>
                          <TableCell>{dateTime(x.dropoffAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="charges">
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="gap-2 pb-0">
                <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Charge</TableHead><TableHead className="text-right">Unit</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.chargeLines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(l.units) || ""}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.kind === "TAX" && l.tax?.kind !== "AMOUNT" ? `${Number(l.rate)}%` : Number(l.rate) ? money(l.rate) : ""}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.kind === "MILEAGE" ? "" : money(l.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold"><TableCell colSpan={3}>Total</TableCell><TableCell className="text-right tabular-nums">{money(t.total)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </Card>
              <Card className="gap-2 pb-0">
                <CardHeader className="items-center">
                  <CardTitle>Payments</CardTitle>
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
                            cardLast4: x.cardLast4 as string | undefined,
                            takenAt: new Date(x.takenAt as string),
                          }),
                        )
                      }
                    >
                      <SelectField label="Payment method" name="method" required options={PAYMENT_METHOD_OPTIONS} />
                      <SelectField label="Transaction type" name="transactionType" placeholder={false} options={[{ value: "PAYMENT", label: "Payment (Credit)" }, { value: "AUTHORIZATION", label: "Authorization" }, { value: "REFUND", label: "Refund (Credit)" }]} />
                      <Field label="Amount" name="amount" type="number" step="0.01" min="0.01" required />
                      <Field label="Card last 4" name="cardLast4" inputMode="numeric" maxLength={4} />
                      <Field label="Authorization code" name="authorizationCode" />
                      <Field label="Transaction code" name="transactionCode" />
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
                          <TableCell>{dateTime(p.takenAt)}</TableCell>
                          <TableCell>{p.method}{p.cardLast4 && ` ···· ${p.cardLast4}`}</TableCell>
                          <TableCell><Badge variant={p.transactionType === "PAYMENT" ? "success" : p.transactionType === "REFUND" ? "warning" : "info"}>{p.transactionType.toLowerCase()}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="billsplit">
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Bill split</CardTitle>
                {active && <BillSplitDialog onSubmit={(p) => run(client.staff.reservation.addBillSplit.mutate({ reservationId, ...p }))} />}
              </CardHeader>
              {r.billSplits.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">Not split. The renter pays the full amount.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Type</TableHead><TableHead className="text-right">/ day</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
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
          </TabsContent>

          <TabsContent value="drivers">
            <DriversCard data={data} run={run} />
          </TabsContent>

          <TabsContent value="notes">
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Memo history</CardTitle>
                <FormDialog
                  title="Add memo"
                  trigger={<Button size="sm" variant="outline"><MessageSquarePlusIcon /> Add memo</Button>}
                  onSubmit={(x) => run(client.staff.reservation.addMemo.mutate({ reservationId, body: x.body as string, showAsPopup: Boolean(x.showAsPopup) }))}
                >
                  <TextareaField label="Memo" name="body" required rows={4} />
                  <CheckField label="Always display as popup" name="showAsPopup" />
                </FormDialog>
              </CardHeader>
              {r.memos.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No memos.</p>
              ) : (
                <ul className="divide-y">
                  {r.memos.map((m) => (
                    <li key={m.id} className="space-y-1 px-4 py-3 text-sm">
                      <div className="text-xs text-muted-foreground">{m.author?.name ?? "System"} · {dateTime(m.createdAt)} {m.showAsPopup && <Badge variant="warning">Popup</Badge>}</div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Field</TableHead><TableHead>Old</TableHead><TableHead>New</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.auditLog.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{dateTime(a.at)}</TableCell>
                      <TableCell>{a.user?.name ?? "System"}</TableCell>
                      <TableCell className="font-medium">{a.field}</TableCell>
                      <TableCell className="text-muted-foreground">{a.oldValue && /^\d{4}-\d\d-\d\dT/.test(a.oldValue) ? dateTime(a.oldValue) : a.oldValue ?? "—"}</TableCell>
                      <TableCell>{a.newValue && /^\d{4}-\d\d-\d\dT/.test(a.newValue) ? dateTime(a.newValue) : a.newValue ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {dialog === "start" && <StartRentalDialog data={data} onOpenChange={close} />}
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

function DL({ items, single }: { items: [string, React.ReactNode][]; single?: boolean }) {
  return (
    <dl className={single ? "grid gap-y-2 text-sm" : "grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2"}>
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr] gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
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
