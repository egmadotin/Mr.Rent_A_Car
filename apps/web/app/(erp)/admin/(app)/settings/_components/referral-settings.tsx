"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, TextareaField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > Financial / Commission > Referrals: the "Source of referral" list on bookings and customers. */
export function ReferralSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.referralList.queryOptions());
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.referralList.queryKey() });
  const editable = can("Settings");
  type R = NonNullable<typeof data>[number];
  const dialog = (x?: R) => (
    <FormDialog
      title={x ? "Edit Referral" : "New Referral"}
      wide
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} disabled={!editable}><PencilIcon /></Button> : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Referral</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.referralSave.mutate({
          id: x?.id, name: String(v.name ?? ""), fullName: v.fullName as string, email: (v.email as string) ?? "", phone: v.phone as string, fax: v.fax as string, memo: v.memo as string, isActive: !!v.isActive,
        });
        await refresh();
      }}
    >
      <Field label="Referral" name="name" required defaultValue={x?.name} />
      <Field label="Full Name" name="fullName" defaultValue={x?.fullName ?? ""} />
      <Field label="Email" name="email" type="email" defaultValue={x?.email ?? ""} />
      <Field label="Phone" name="phone" type="tel" defaultValue={x?.phone ?? ""} />
      <Field label="Fax" name="fax" type="tel" defaultValue={x?.fax ?? ""} />
      <div className="flex items-end"><CheckField label="Active" name="isActive" defaultChecked={x?.isActive ?? true} /></div>
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={x?.memo ?? ""} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Referral</TableHead><TableHead>Full Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Rentals</TableHead><TableHead>Active</TableHead><TableHead className="w-20" /></TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell>{x.fullName}</TableCell>
                <TableCell>{x.email}</TableCell>
                <TableCell>{x.phone}</TableCell>
                <TableCell className="text-right tabular-nums">{x._count.rentals}</TableCell>
                <TableCell>{x.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  {dialog(x)}
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${x.name}`} disabled={!editable} title={editable ? undefined : NO_PERMISSION} onClick={() => setDeleting({ id: x.id, name: x.name })}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Only a referral that was never used can be deleted; otherwise make it inactive."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.setup.referralDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
