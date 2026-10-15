"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, PencilIcon, PinIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { fullName, money } from "@mrac/ui/lib/format";
import { errorMessage } from "../../../../../_components/form";
import { ActionLink, DL } from "../../../../../_components/legacy-view";
import { legacyDate } from "../../../../../_components/list-kit";
import { PageHeader } from "../../../../../_components/page-header";
import { BillingTab } from "./billing-tab";
import { ChargeTable, ChargesTab } from "./charges-tab";
import { ClaimsTab } from "./claims-tab";
import { DriversTab } from "./drivers-tab";
import { ActivityTab, NotesTab } from "./notes-tab";
import { OverviewTab } from "./overview-tab";
import { RentalDialogs, type RentalDialog } from "./rental-dialogs";
import { useRentalActions, type RentalData } from "./use-rental";

type Panel =
  | null | "payments" | "drivers" | "commissions" | "exchange" | "adjustments" | "tickets" | "billsplit" | "invoices" | "notes"
  | "transports" | "log" | "claims" | "memos";

const NOT_BUILT = "Not available yet: the template / email provider is set up in a later step.";

/**
 * Rental view = RentCentric AgreementMain.aspx: "Rental# n" + Edit, the two-column field grid, the action links in its
 * order (two per row), Memo + Memo History + Save, and the charge table with payments and balance on the right.
 * Each link opens its panel (the same sections the rental tabs use) or its dialog.
 */
export function RentalDetail({ rentalId }: { rentalId: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.staff.rental.byId.queryOptions({ rentalId }));
  const data = q.data as RentalData | undefined;
  const [dialog, setDialog] = React.useState<RentalDialog>(null);
  const [panel, setPanel] = React.useState<Panel>(null);
  const toggle = (p: Panel) => () => setPanel((cur) => (cur === p ? null : p));

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading rental…</div>;
  if (q.error || !data) return <div className="p-6 text-sm text-destructive">{q.error?.message ?? "Rental not found."}</div>;

  const r = data.rental;
  const t = data.totals;
  const tz = r.checkOutLocation.timeZone;
  const d = (x: Date | string | null | undefined) => legacyDate(x, { timeZone: tz });
  const open = r.status === "OPEN";
  const popups = r.memos.filter((m) => m.showAsPopup);
  const memos = r.memos.filter((m) => m.kind === "MEMO");
  const notes = r.memos.filter((m) => m.kind === "NOTE");
  const exchanges = Math.max(0, r.vehicleSegments.length - 1);
  const status =
    r.status === "CLOSED"
      ? `Closed (${r.checkedInAt ? new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date(r.checkedInAt)) : ""})`
      : r.status === "VOIDED"
        ? "Voided"
        : "Open";

  // AgreementMain.aspx action links, two per row, in its order
  const links: React.ReactNode[] = [
    <ActionLink key="end" href={`/admin/rentals/${r.id}/end`} disabled={!open} title="Only an open rental can be ended">End Rental</ActionLink>,
    <ActionLink key="pay" onClick={toggle("payments")} active={panel === "payments"}>Payments/Charges ({r.payments.length})</ActionLink>,
    <ActionLink key="drv" onClick={toggle("drivers")} active={panel === "drivers"}>Additional Drivers ({r.drivers.length})</ActionLink>,
    <ActionLink key="com" onClick={toggle("commissions")} active={panel === "commissions"}>Commissions ({r.commissions.length})</ActionLink>,
    <ActionLink key="print" href={`/admin/print/rentals/${r.id}`} newTab>Print Rental/Invoice</ActionLink>,
    <ActionLink
      key="ex"
      onClick={() => {
        setPanel("exchange");
        if (open) setDialog("exchange");
      }}
      active={panel === "exchange"}
    >
      Vehicle Exchange ({exchanges})
    </ActionLink>,
    <ActionLink key="email" disabled title={NOT_BUILT}>Email Agreement/Invoice</ActionLink>,
    <ActionLink key="adj" onClick={toggle("adjustments")} active={panel === "adjustments"}>Adjustments ({r.adjustments.length})</ActionLink>,
    <ActionLink key="void" onClick={() => setDialog("void")} disabled={r.status === "VOIDED"} title="Already voided">Void Rental</ActionLink>,
    <ActionLink key="tt" onClick={toggle("tickets")} active={panel === "tickets"}>Traffic Tickets ({r.trafficTickets.length})</ActionLink>,
    <ActionLink key="del" onClick={() => setDialog("delete")}>Delete Rental</ActionLink>,
    <ActionLink key="bs" onClick={toggle("billsplit")} active={panel === "billsplit"}>Bill Split ({r.billSplits.length})</ActionLink>,
    <ActionLink key="inv" onClick={toggle("invoices")} active={panel === "invoices"}>Invoices ({r.invoices.length})</ActionLink>,
    <ActionLink key="notes" onClick={toggle("notes")} active={panel === "notes"}>Notes ({notes.length})</ActionLink>,
    <ActionLink key="tr" onClick={toggle("transports")} active={panel === "transports"}>Pickup/Drop-off ({r.transports.length})</ActionLink>,
    <ActionLink key="log" onClick={toggle("log")} active={panel === "log"}>Agreements Log</ActionLink>,
    r.reservation ? (
      <ActionLink key="res" href={`/admin/reservations/${r.reservation.id}`}>Check Original Reservation</ActionLink>
    ) : (
      <ActionLink key="res" disabled title="This rental was started without a reservation">Check Original Reservation</ActionLink>
    ),
    <ActionLink key="insp" disabled title="Available once vehicle inspections are built">Inspection Comparison</ActionLink>,
    <ActionLink key="reopen" onClick={() => setDialog("reopen")} disabled={r.status !== "CLOSED"} title="Only a closed rental can be reopened">ReOpen Rental</ActionLink>,
    <ActionLink key="unvoid" onClick={() => setDialog("unvoid")} disabled={r.status !== "VOIDED"} title="Only a voided rental can be unvoided">UnVoid Rental</ActionLink>,
    <ActionLink key="rate" onClick={() => setDialog("rate")}>Update Exchange Rate</ActionLink>,
    <ActionLink key="cl" onClick={toggle("claims")} active={panel === "claims"}>Claims</ActionLink>,
    <ActionLink key="cl2" onClick={toggle("claims")} active={panel === "claims"}>Claims V2</ActionLink>,
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Customers Utility", href: "/admin/customers" },
          { label: `${fullName(r.customer).toUpperCase()}${r.customer.legacyId ? ` (${r.customer.legacyId})` : ""}`, href: `/admin/customers/${r.customerId}` },
          { label: "Rentals", href: "/admin/rentals" },
        ]}
        title={`Rental# ${r.raNumber}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/admin/rentals/${r.id}/edit`}><PencilIcon /> Edit</Link>
          </Button>
        }
      />

      <div className="grid gap-6 p-4 md:p-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {popups.map((m) => (
            <div key={m.id} role="note" className="flex gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
              <PinIcon className="mt-0.5 size-4 shrink-0" /> {m.body}
            </div>
          ))}
          {r.customer.isUndesired && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangleIcon className="size-4" /> This renter is on the undesired (do-not-rent) list.
            </div>
          )}

          {/* the fields of AgreementMain.aspx, in its two columns */}
          <Card>
            <CardContent className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              <DL
                single
                items={[
                  ["Status:", status],
                  ["Type:", r.vehicleType.name],
                  ["Pickup Date:", d(r.checkOutAt)],
                  ["Return Date:", d(r.checkedInAt ?? r.expectedReturnAt)],
                  ["Opened By:", r.openedBy?.name],
                  ["Check-Out Channel:", r.checkOutChannel],
                  ["Company:", r.company?.name ?? "N/A"],
                  ["Customer Balance:", money(data.customerBalance)],
                ]}
              />
              <DL
                single
                items={[
                  [
                    "Vehicle:",
                    <span key="v">
                      <Link href={`/admin/vehicles/${r.vehicle.id}`} className="text-primary hover:underline">({r.vehicle.assignedId})</Link> {r.vehicle.make.name} {r.vehicle.model.name}
                    </span>,
                  ],
                  ["Pickup Location:", r.checkOutLocation.name],
                  ["Return Location:", r.checkInLocation.name],
                  ["Referral:", r.referral?.name ?? "N/A"],
                  ["Closed By:", r.closedBy?.name],
                  ["Check-In Channel:", r.checkInChannel],
                  ["Split Bill Balance:", money(t.splitBillBalance)],
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

          {panel === "payments" && <BillingTab data={data} show="payments" />}
          {panel === "commissions" && <BillingTab data={data} show="commissions" />}
          {panel === "billsplit" && <BillingTab data={data} show="billsplit" />}
          {panel === "invoices" && <BillingTab data={data} show="invoices" />}
          {panel === "drivers" && <DriversTab data={data} show="drivers" />}
          {panel === "exchange" && <DriversTab data={data} show="exchange" />}
          {panel === "adjustments" && <ChargesTab data={data} show="adjustments" />}
          {panel === "tickets" && <ClaimsTab data={data} show="tickets" />}
          {panel === "claims" && <ClaimsTab data={data} show="claims" />}
          {panel === "notes" && <NotesTab data={data} show="notes" />}
          {panel === "memos" && <NotesTab data={data} show="memos" />}
          {panel === "transports" && <OverviewTab data={data} show="transports" />}
          {panel === "log" && <ActivityTab data={data} />}

          <MemoBox rentalId={r.id} latest={memos[0]?.body ?? ""} count={memos.length} onHistory={toggle("memos")} />
        </div>

        {/* charges, as on AgreementMain.aspx: … Total, payments, Total Payments, Balance */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <Card className="py-0"><ChargeTable data={data} /></Card>
        </div>
      </div>

      <RentalDialogs data={data} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

/** "Memo" box with the latest memo, "Memo History (n)" and "Save" (adds a new memo). */
function MemoBox({ rentalId, latest, count, onHistory }: { rentalId: string; latest: string; count: number; onHistory: () => void }) {
  const { api, run } = useRentalActions(rentalId);
  const [body, setBody] = React.useState(latest);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setBody(latest), [latest]);
  return (
    <div className="space-y-2">
      <label htmlFor="rental-memo" className="text-sm">Memo</label>
      <Textarea id="rental-memo" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onHistory}>Memo History ({count})</Button>
        <Button
          type="button"
          disabled={saving || !body.trim() || body === latest}
          onClick={async () => {
            setSaving(true);
            try {
              await run(api.addMemo.mutate({ rentalId, kind: "MEMO", body, showAsPopup: false }));
              toast.success("Memo saved");
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
