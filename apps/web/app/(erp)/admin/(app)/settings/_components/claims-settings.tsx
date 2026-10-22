"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, money } from "@mrac/ui/lib/format";

/**
 * Settings > Claims Management (ClaimsMain.aspx): every claim — on rentals and on vehicles — with RentCentric's
 * Claim ID (Status), Claim Date, Claim Close Date, plus where it belongs. Claims are added from the rental or vehicle page.
 */
const STATUS: Record<string, string> = { OPEN: "Open", PENDING: "Pending", CLOSED: "Closed" };
const TYPE: Record<string, string> = { RENTER: "Renter", THIRD_PARTY: "3rd Party", OTHER: "Other" };

export function ClaimsManagement() {
  const trpc = useTRPC();
  const [status, setStatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");
  const q = useQuery(
    trpc.staff.vehicleRecords.allClaims.queryOptions({
      status: status as "",
      from: from ? new Date(`${from}T00:00`) : undefined,
      to: to ? new Date(`${to}T00:00`) : undefined,
      search: search || undefined,
    }),
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="cl-s">Claim #</Label><Input id="cl-s" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40" /></div>
        <div className="space-y-1">
          <Label htmlFor="cl-st">Status</Label>
          <NativeSelect id="cl-st" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="">All</option>
            {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1"><Label htmlFor="cl-f">Claim Date from</Label><Input id="cl-f" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="cl-t">to</Label><Input id="cl-t" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim ID (Status)</TableHead><TableHead>Claim Date</TableHead><TableHead>Claim Close Date</TableHead><TableHead>Type</TableHead>
              <TableHead>Rental #</TableHead><TableHead>Renter</TableHead><TableHead>Vehicle</TableHead><TableHead className="text-right">Deductible</TableHead><TableHead className="text-right">Total Payments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {q.data?.map((c) => {
              const v = c.vehicle ?? c.rental?.vehicle;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.claimNumber || "—"} ({STATUS[c.status]})</TableCell>
                  <TableCell>{date(c.claimDate)}</TableCell>
                  <TableCell>{date(c.closeDate)}</TableCell>
                  <TableCell>{TYPE[c.type]}</TableCell>
                  <TableCell>{c.rental ? <Link className="text-primary hover:underline" href={`/admin/rentals/${c.rental.id}`}>{c.rental.raNumber}</Link> : "—"}</TableCell>
                  <TableCell>{c.rental ? `${c.rental.customer.firstName} ${c.rental.customer.lastName}` : "—"}</TableCell>
                  <TableCell>{v ? <Link className="text-primary hover:underline" href={`/admin/vehicles/${v.id}`}>{v.assignedId}</Link> : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.deductible != null ? money(c.deductible) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.totalPayments != null ? money(c.totalPayments) : ""}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="text-sm text-muted-foreground">New claims are added from a rental (Claims) or a vehicle (Vehicle Claims).</p>
    </div>
  );
}
