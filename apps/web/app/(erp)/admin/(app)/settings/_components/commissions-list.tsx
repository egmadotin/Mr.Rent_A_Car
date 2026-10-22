"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, money } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > Commissions (CommissionsMain.aspx): Rental#, Amount, Date Entered, Referral, User, Entered By, Delete. */
export function CommissionsList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const input = { from: from ? new Date(`${from}T00:00`) : undefined, to: to ? new Date(`${to}T00:00`) : undefined };
  const { data } = useQuery(trpc.staff.rental.allCommissions.queryOptions(input));
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.rental.allCommissions.queryKey() });
  const total = (data ?? []).reduce((a, c) => a + Number(c.amount), 0);
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="cm-f">Date Entered from</Label><Input id="cm-f" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="cm-t">to</Label><Input id="cm-t" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <Card className="max-w-5xl gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Rental#</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date Entered</TableHead><TableHead>Referral</TableHead><TableHead>User</TableHead><TableHead>Entered By</TableHead><TableHead className="w-16">Delete</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Link className="text-primary hover:underline" href={`/admin/rentals/${c.rental.id}`}>{c.rental.raNumber}</Link></TableCell>
                <TableCell className="text-right tabular-nums">{money(c.amount)}</TableCell>
                <TableCell>{dateTime(c.enteredAt)}</TableCell>
                <TableCell>{c.referral?.name ?? ""}</TableCell>
                <TableCell>{c.user?.name ?? ""}</TableCell>
                <TableCell>{c.enteredBy?.name ?? ""}</TableCell>
                <TableCell>
                  <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete commission" disabled={!can("CommissionsDelete")} title={can("CommissionsDelete") ? undefined : NO_PERMISSION} onClick={() => setDeleting(c.id)}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {!!data?.length && (
            <tfoot><tr className="border-t font-semibold"><td className="px-2 py-2">Total</td><td className="px-2 py-2 text-right tabular-nums">{money(total)}</td><td colSpan={5} /></tr></tfoot>
          )}
        </Table>
      </Card>
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete this commission?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => client.staff.rental.deleteCommission.mutate({ commissionId: deleting! }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
