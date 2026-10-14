"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  CreditCardIcon,
  FlagIcon,
  KeyRoundIcon,
  MessageSquarePlusIcon,
  NotebookTabsIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  PowerIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";
import type { RouterOutputs, Wire } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrac/ui/components/tooltip";
import { date, dateTime, fullName } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, TextareaField } from "../../../../_components/form";
import { PageHeader } from "../../../../_components/page-header";
import { RentalStatusBadge } from "../../rentals/status-badge";
import { ReservationStatusBadge } from "../../reservations/status";

type Data = Wire<RouterOutputs["staff"]["customer"]["byId"]>;

function ageOf(dob: Date | string | null) {
  if (!dob) return null;
  const b = new Date(dob);
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export function CustomerDetail({ customerId }: { customerId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const q = useQuery(trpc.staff.customer.byId.queryOptions({ customerId }));
  const data = q.data as Data | undefined;
  const [deactivate, setDeactivate] = React.useState(false);
  const run = async <T,>(p: Promise<T>) => {
    const r = await p;
    await qc.invalidateQueries({ queryKey: trpc.staff.customer.byId.queryKey({ customerId }) });
    return r;
  };

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading customer…</div>;
  if (!data) return <div className="p-6 text-sm text-destructive">{q.error?.message ?? "Customer not found."}</div>;
  const c = data.customer;
  const age = ageOf(c.birthDate);
  const openRental = c.rentals.find((r) => r.status === "OPEN");
  const notes = c.memos;
  const popups = c.memos.filter((m) => m.showAsPopup);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: fullName(c) }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {fullName(c)}
            {!c.isActive && <Badge variant="muted">Inactive</Badge>}
            {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
            {c.isPreferred && <Badge variant="info">Preferred</Badge>}
            {c.isClubMember && <Badge variant="success">Club member</Badge>}
            {c.identityVerified ? <Badge variant="success"><BadgeCheckIcon /> ID verified</Badge> : <Badge variant="muted">ID not verified</Badge>}
          </span>
        }
        description={[c.phone, c.email].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {openRental ? (
              <Button asChild><Link href={`/admin/rentals/${openRental.id}`}><FlagIcon /> End rental #{openRental.raNumber}</Link></Button>
            ) : (
              c.isUndesired ? (
                <Button disabled title="On the do-not-rent list"><KeyRoundIcon /> Start rental</Button>
              ) : (
                <Button asChild><Link href={`/admin/rentals/new?customerId=${c.id}`}><KeyRoundIcon /> Start rental</Link></Button>
              )
            )}
            <Button variant="outline" asChild><Link href={`/admin/reservations/new?customerId=${c.id}`}><NotebookTabsIcon /> New reservation</Link></Button>
            <Button variant="outline" asChild><Link href={`/admin/customers/${c.id}/edit`}><PencilIcon /> Edit</Link></Button>
            {c.isActive ? (
              <Button variant="destructive-outline" onClick={() => setDeactivate(true)}><PowerIcon /> Deactivate</Button>
            ) : (
              <Button variant="outline" onClick={() => run(client.staff.customer.setActive.mutate({ customerId, isActive: true }))}><PowerIcon /> Reactivate</Button>
            )}
          </>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        {popups.map((m) => (
          <div key={m.id} role="note" className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm"><PinIcon className="mt-0.5 size-4 shrink-0" /> {m.body}</div>
        ))}
        {data.duplicates.length > 0 && (
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            <p className="mb-1 flex items-center gap-2 font-medium"><UsersIcon className="size-4" /> Possible duplicate records</p>
            <p className="text-muted-foreground">
              {data.duplicates.map((d, i) => (
                <React.Fragment key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/admin/customers/${d.id}`} className="text-primary hover:underline">{d.firstName} {d.lastName}</Link>
                  {d.phone && ` (${d.phone})`}
                </React.Fragment>
              ))}
            </p>
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rentals">Rentals <Badge variant="muted" className="px-1.5">{c.rentals.length}</Badge></TabsTrigger>
            <TabsTrigger value="reservations">Reservations <Badge variant="muted" className="px-1.5">{c.reservations.length}</Badge></TabsTrigger>
            <TabsTrigger value="cards">Credit cards</TabsTrigger>
            <TabsTrigger value="club">Club member</TabsTrigger>
            <TabsTrigger value="ids">Scanned IDs</TabsTrigger>
            <TabsTrigger value="notes">Notes {notes.length > 0 && <Badge variant="muted" className="px-1.5">{notes.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader><CardTitle>Customer information</CardTitle></CardHeader>
                <CardContent>
                  <DL
                    items={[
                      ["Phone", c.phone],
                      ["Cell phone", c.cellPhone],
                      ["Email", c.email],
                      ["Emergency contact", c.emergencyContactPhone],
                      ["Address", [c.address1, c.address2].filter(Boolean).join(", ")],
                      ["City / zip", [c.city, c.postal].filter(Boolean).join(" ")],
                      ["Province / state", c.province],
                      ["Country", c.country],
                      ["Driver's licence", c.licenseNumber],
                      ["Licence expiration", <span key="le">{date(c.licenseExpiry)}{c.licenseExpiry && new Date(c.licenseExpiry) < new Date() && <Badge variant="destructive" className="ml-2">Expired</Badge>}</span>],
                      ["Licence province", c.licenseProvince],
                      ["Date of birth", c.birthDate ? <span key="dob">{date(c.birthDate)} · age {age}{age !== null && age < 25 && <Badge variant="warning" className="ml-2">Under 25</Badge>}</span> : null],
                      ["Insurance", [c.insuranceCompany, c.insurancePolicyNumber].filter(Boolean).join(" · ")],
                      ["Insurance expiry", date(c.insuranceExpiry)],
                      ["Company", c.company ? c.company.name : null],
                      ["Default location", c.defaultLocation?.name],
                      ["Region", c.region?.name],
                      ["Source of referral", c.referral?.name],
                      ["Registration channel", c.registrationChannel],
                      ["ID verification", c.identityVerified ? `Verified · ${c.identityVerifiedMethod?.toLowerCase() ?? "manual"} · ${dateTime(c.identityVerifiedAt)}` : "Not verified"],
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Linked drivers</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.primaryCustomer && (
                    <p>Additional driver for <Link className="text-primary hover:underline" href={`/admin/customers/${c.primaryCustomer.id}`}>{c.primaryCustomer.firstName} {c.primaryCustomer.lastName}</Link></p>
                  )}
                  {c.linkedDrivers.length === 0 && !c.primaryCustomer && <p className="text-muted-foreground">None.</p>}
                  <ul className="space-y-1">
                    {c.linkedDrivers.map((d) => (
                      <li key={d.id}><Link className="text-primary hover:underline" href={`/admin/customers/${d.id}`}>{d.firstName} {d.lastName}</Link> <span className="text-muted-foreground">· Lic {d.licenseNumber ?? "—"}</span></li>
                    ))}
                  </ul>
                  {c.isUndesired && <p className="flex items-center gap-2 pt-2 text-destructive"><AlertTriangleIcon className="size-4" /> On the do-not-rent list.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rentals">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader><TableRow><TableHead>Rental #</TableHead><TableHead>Vehicle</TableHead><TableHead>Pickup</TableHead><TableHead>Return</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {c.rentals.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No rentals.</TableCell></TableRow>}
                  {c.rentals.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Link href={`/admin/rentals/${r.id}`} className="font-medium text-primary hover:underline">{r.raNumber}</Link></TableCell>
                      <TableCell>{r.vehicle.assignedId}</TableCell>
                      <TableCell>{dateTime(r.checkOutAt)}</TableCell>
                      <TableCell>{dateTime(r.checkedInAt ?? r.expectedReturnAt)}</TableCell>
                      <TableCell><RentalStatusBadge status={r.status} expectedReturnAt={r.expectedReturnAt} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader><TableRow><TableHead>Reservation #</TableHead><TableHead>Vehicle type</TableHead><TableHead>Pickup</TableHead><TableHead>Return</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {c.reservations.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No reservations.</TableCell></TableRow>}
                  {c.reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Link href={`/admin/reservations/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link></TableCell>
                      <TableCell>{r.vehicleType.name}</TableCell>
                      <TableCell>{dateTime(r.pickupAt)}</TableCell>
                      <TableCell>{dateTime(r.returnAt)}</TableCell>
                      <TableCell><ReservationStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="cards">
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Credit cards</CardTitle>
                <FormDialog
                  title="Add credit card"
                  description="Only the card type, last 4 digits and expiry are stored — never the full number or CVV."
                  trigger={<Button size="sm" variant="outline"><PlusIcon /> Add</Button>}
                  onSubmit={(v) =>
                    run(
                      client.staff.customer.addCreditCard.mutate({
                        customerId,
                        description: v.description as string | undefined,
                        brand: v.brand as string,
                        last4: v.last4 as string,
                        expMonth: Number(v.expMonth),
                        expYear: Number(v.expYear),
                        holderName: v.holderName as string | undefined,
                      }),
                    )
                  }
                >
                  <Field label="Description" name="description" />
                  <SelectField label="Card type" name="brand" required options={["Visa", "Mastercard", "Amex", "Debit", "Other"]} />
                  <Field label="Last 4 digits" name="last4" required inputMode="numeric" pattern="\d{4}" maxLength={4} />
                  <Field label="Card holder" name="holderName" />
                  <SelectField label="Exp. month" name="expMonth" required options={Array.from({ length: 12 }, (_, i) => String(i + 1))} />
                  <SelectField label="Exp. year" name="expYear" required options={Array.from({ length: 12 }, (_, i) => String(new Date().getFullYear() + i))} />
                </FormDialog>
              </CardHeader>
              {c.creditCards.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No cards on file.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Card</TableHead><TableHead>Card holder</TableHead><TableHead>Expiration</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {c.creditCards.map((cc) => (
                      <TableRow key={cc.id}>
                        <TableCell>{cc.description ?? "—"}</TableCell>
                        <TableCell className="flex items-center gap-1.5"><CreditCardIcon className="size-4 text-muted-foreground" /> {cc.brand} ···· {cc.last4}</TableCell>
                        <TableCell>{cc.holderName ?? "—"}</TableCell>
                        <TableCell>{String(cc.expMonth).padStart(2, "0")}/{cc.expYear}</TableCell>
                        <TableCell>{cc.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => run(client.staff.customer.setCreditCardActive.mutate({ creditCardId: cc.id, isActive: !cc.isActive }))}>
                            {cc.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="club">
            <Card>
              <CardHeader className="items-center">
                <CardTitle>Club member information</CardTitle>
                <FormDialog
                  title="Club member information"
                  trigger={<Button size="sm" variant="outline"><PencilIcon /> {c.clubMembership ? "Edit" : "Add"}</Button>}
                  onSubmit={(v) =>
                    run(
                      client.staff.customer.saveClubMembership.mutate({
                        customerId,
                        gCode: v.gCode as string | undefined,
                        cardNumber: v.cardNumber as string | undefined,
                        issuedAt: (v.issuedAt as string) || null,
                        expiresAt: (v.expiresAt as string) || null,
                        sentAt: (v.sentAt as string) || null,
                        status: v.status as string | undefined,
                      } as never),
                    )
                  }
                >
                  <Field label="GCode" name="gCode" defaultValue={c.clubMembership?.gCode ?? ""} />
                  <Field label="Card no." name="cardNumber" defaultValue={c.clubMembership?.cardNumber ?? ""} />
                  <Field label="Date issued" name="issuedAt" type="date" defaultValue={c.clubMembership?.issuedAt ? new Date(c.clubMembership.issuedAt).toISOString().slice(0, 10) : ""} />
                  <Field label="Expiration date" name="expiresAt" type="date" defaultValue={c.clubMembership?.expiresAt ? new Date(c.clubMembership.expiresAt).toISOString().slice(0, 10) : ""} />
                  <Field label="Send date" name="sentAt" type="date" defaultValue={c.clubMembership?.sentAt ? new Date(c.clubMembership.sentAt).toISOString().slice(0, 10) : ""} />
                  <Field label="Status" name="status" defaultValue={c.clubMembership?.status ?? ""} />
                </FormDialog>
              </CardHeader>
              <CardContent>
                {c.clubMembership ? (
                  <DL
                    items={[
                      ["GCode", c.clubMembership.gCode],
                      ["Card no.", c.clubMembership.cardNumber],
                      ["Date issued", date(c.clubMembership.issuedAt)],
                      ["Expiration", date(c.clubMembership.expiresAt)],
                      ["Send date", date(c.clubMembership.sentAt)],
                      ["Status", c.clubMembership.status],
                    ]}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Not a club member.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ids">
            <Card>
              <CardHeader className="items-center">
                <CardTitle>Scanned IDs</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}><Button size="sm" variant="outline" disabled><UploadIcon /> Upload</Button></span>
                  </TooltipTrigger>
                  <TooltipContent>Uploads need the S3 bucket configured. Plustek scans will land here too.</TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                {c.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scanned IDs.</p>
                ) : (
                  <ul className="space-y-1 text-sm">{c.attachments.map((a) => <li key={a.id}>{a.fileName} · {dateTime(a.uploadedAt)}</li>)}</ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="gap-2 pb-0">
              <CardHeader className="items-center">
                <CardTitle>Notes</CardTitle>
                <FormDialog
                  title="New note"
                  trigger={<Button size="sm" variant="outline"><MessageSquarePlusIcon /> New note</Button>}
                  onSubmit={(v) => run(client.staff.customer.addNote.mutate({ customerId, body: v.body as string, showAsPopup: Boolean(v.showAsPopup) }))}
                >
                  <TextareaField label="Note" name="body" required rows={4} />
                  <CheckField label="Always display as popup" name="showAsPopup" />
                </FormDialog>
              </CardHeader>
              {notes.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No notes.</p>
              ) : (
                <ul className="divide-y">
                  {notes.map((m) => (
                    <li key={m.id} className="space-y-1 px-4 py-3 text-sm">
                      <div className="text-xs text-muted-foreground">{m.author?.name ?? "System"} · {dateTime(m.createdAt)} {m.showAsPopup && <Badge variant="warning">Popup</Badge>}</div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Record</TableHead><TableHead>Change</TableHead><TableHead>IP address</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.history.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No history.</TableCell></TableRow>}
                  {data.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{dateTime(h.at)}</TableCell>
                      <TableCell>{h.user?.name ?? "System"}</TableCell>
                      <TableCell>{h.entityType}</TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{h.field}</span>
                        {h.oldValue || h.newValue ? <span className="text-muted-foreground"> {h.oldValue ?? "—"} → {h.newValue ?? "—"}</span> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{h.ipAddress ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmAction
        open={deactivate}
        onOpenChange={setDeactivate}
        destructive
        title="Deactivate customer"
        description={<>{fullName(c)} will be hidden from searches and can&apos;t be added to new bookings. History is kept and you can reactivate any time.</>}
        confirmLabel="Deactivate"
        onConfirm={() => run(client.staff.customer.setActive.mutate({ customerId, isActive: false }))}
      />
    </>
  );
}

function DL({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr] gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}
