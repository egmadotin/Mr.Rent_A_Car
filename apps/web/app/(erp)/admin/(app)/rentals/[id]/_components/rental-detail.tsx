"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, PinIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { dateTime, fullName, money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { PageHeader } from "../../../../../_components/page-header";
import { RentalStatusBadge } from "../../status-badge";
import { BillingTab } from "./billing-tab";
import { ChargesTab } from "./charges-tab";
import { ClaimsTab } from "./claims-tab";
import { DriversTab } from "./drivers-tab";
import { HeaderActions } from "./header-actions";
import { ActivityTab, NotesTab } from "./notes-tab";
import { OverviewTab } from "./overview-tab";
import type { RentalData } from "./use-rental";

export function RentalDetail({ rentalId }: { rentalId: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.staff.rental.byId.queryOptions({ rentalId }));
  const { isLoading, error } = q;
  const data = q.data as RentalData | undefined;

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading rental…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">{error?.message ?? "Rental not found."}</div>;

  const r = data.rental;
  const t = data.totals;
  const popups = r.memos.filter((m) => m.showAsPopup);
  const statusLine =
    r.status === "CLOSED" && r.checkedInAt
      ? `Closed ${dateTime(r.checkedInAt)}`
      : r.status === "VOIDED" && r.voidedAt
        ? `Voided ${dateTime(r.voidedAt)}`
        : `Due back ${dateTime(r.expectedReturnAt)}`;

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "charges", label: "Charges", count: r.adjustments.length || undefined },
    { value: "billing", label: "Payments & billing", count: r.payments.length + r.billSplits.length + r.commissions.length + r.invoices.length },
    { value: "drivers", label: "Drivers & vehicles", count: r.drivers.length || undefined },
    { value: "claims", label: "Tickets & claims", count: r.trafficTickets.length + r.claims.length || undefined },
    { value: "notes", label: "Notes", count: r.memos.length || undefined },
    { value: "activity", label: "Activity log" },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Rentals", href: "/admin/rentals" },
          { label: fullName(r.customer), href: `/admin/customers/${r.customerId}` },
          { label: `#${r.raNumber}` },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Rental #{r.raNumber}
            <RentalStatusBadge status={r.status} expectedReturnAt={r.expectedReturnAt} />
          </span>
        }
        description={
          <>
            {fullName(r.customer)} · {r.vehicle.make.name} {r.vehicle.model.name} ({r.vehicle.assignedId}) · {statusLine}
          </>
        }
        actions={<HeaderActions data={data} />}
      />

      <div className="space-y-4 p-4 md:p-6">
        {popups.length > 0 && (
          <div role="note" className="space-y-1 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            {popups.map((m) => (
              <p key={m.id} className="flex gap-2">
                <PinIcon className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" />
                <span>{m.body}</span>
              </p>
            ))}
          </div>
        )}
        {r.customer.isUndesired && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangleIcon className="size-4" /> This renter is on the undesired (do-not-rent) list.
          </div>
        )}

        {/* Money at a glance */}
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              ["Total", t.total],
              ["Payments", t.totalPayments],
              ["Balance", t.balance, Number(t.balance) > 0.005 ? "bad" : Number(t.balance) < -0.005 ? "warn" : "ok"],
              ["Split bill balance", t.splitBillBalance],
              ["Customer balance", data.customerBalance, Number(data.customerBalance) > 0.005 ? "bad" : undefined],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="border-b border-r px-4 py-3 last:border-r-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  tone === "bad" && "text-destructive",
                  tone === "warn" && "text-warning-foreground dark:text-warning",
                  tone === "ok" && "text-success",
                )}
              >
                {money(value)}
              </dd>
            </div>
          ))}
        </dl>

        <Tabs defaultValue="overview">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                {tab.count ? <Badge variant="muted" className="px-1.5">{tab.count}</Badge> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview"><OverviewTab data={data} /></TabsContent>
          <TabsContent value="charges"><ChargesTab data={data} /></TabsContent>
          <TabsContent value="billing"><BillingTab data={data} /></TabsContent>
          <TabsContent value="drivers"><DriversTab data={data} /></TabsContent>
          <TabsContent value="claims"><ClaimsTab data={data} /></TabsContent>
          <TabsContent value="notes"><NotesTab data={data} /></TabsContent>
          <TabsContent value="activity"><ActivityTab data={data} /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}
