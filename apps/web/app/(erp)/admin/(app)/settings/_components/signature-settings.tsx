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
import { date } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, TextareaField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Settings > Signature And Initials (SignatureSetupsMain: Signature Name, Type, Misc Charge, Insurance, Condition,
 * Effective Date, End Date, Active, Delete). Printouts show each one at ##Signature\<Code>##.
 */

const CONDITIONS = [{ value: "ADDED", label: "is added" }, { value: "NOT_ADDED", label: "is not added" }, { value: "ALWAYS", label: "always on" }];
const TYPES = [{ value: "SIGNATURE", label: "Signature" }, { value: "INITIALS", label: "initials" }];
const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const token = (code: string) => `##Signature\\${code}##`;

export function SignatureSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.template.signatureList.queryOptions());
  const o = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data;
  // one entry per name (charges repeat per location)
  const misc = [...new Map((o?.miscCharges ?? []).map((m) => [m.name, m.id])).entries()].map(([label, value]) => ({ value, label }));
  const ins = [...new Map((o?.insurances ?? []).map((m) => [m.name, m.id])).entries()].map(([label, value]) => ({ value, label }));
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.template.signatureList.queryKey() });
  const editable = can("AgreementFormsEdit");
  type S = NonNullable<typeof data>[number];
  const dialog = (x?: S) => (
    <FormDialog
      title={x ? "Edit Signature" : "Add Signature"}
      wide
      trigger={
        x ? (
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} disabled={!editable}><PencilIcon /></Button>
        ) : (
          <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add Signature/Initials</Button>
        )
      }
      onSubmit={async (v) => {
        await client.staff.template.signatureSave.mutate({
          id: x?.id, name: String(v.name ?? ""), code: String(v.code ?? ""), condition: v.condition as "ADDED", type: v.type as "SIGNATURE",
          effectiveDate: v.effectiveDate as never, endDate: v.endDate as never, miscChargeId: v.miscChargeId as string, insuranceId: v.insuranceId as string,
          disclaimer: String(v.disclaimer ?? ""), isActive: !!v.isActive,
        });
        await refresh();
      }}
    >
      <Field label="Name" name="name" required defaultValue={x?.name} />
      <Field label="Code" name="code" required defaultValue={x?.code} hint={`Letters and numbers. Printouts show it at ${token("Code")}.`} />
      <SelectField label="Condition" name="condition" options={CONDITIONS} placeholder={false} defaultValue={x?.condition ?? "ADDED"} />
      <SelectField label="Signature Type" name="type" options={TYPES} placeholder={false} defaultValue={x?.type ?? "SIGNATURE"} />
      <Field label="Effective Date" name="effectiveDate" type="date" required defaultValue={ymd(x?.effectiveDate)} />
      <Field label="End Date" name="endDate" type="date" required defaultValue={ymd(x?.endDate)} />
      <SelectField label="Misc Charge" name="miscChargeId" options={misc} placeholder="" defaultValue={x?.miscChargeId ?? ""} />
      <SelectField label="Insurance" name="insuranceId" options={ins} placeholder="" defaultValue={x?.insuranceId ?? ""} />
      <TextareaField label="Disclaimer (HTML)" name="disclaimer" rows={6} className="font-mono text-xs" defaultValue={x?.disclaimer ?? ""} />
      <CheckField label="Active" name="isActive" defaultChecked={x?.isActive ?? true} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signature Name</TableHead><TableHead>Type</TableHead><TableHead>Misc Charge</TableHead><TableHead>Insurance</TableHead><TableHead>Condition</TableHead>
              <TableHead>Effective Date</TableHead><TableHead>End Date</TableHead><TableHead>Active</TableHead><TableHead className="w-20">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name} <code className="text-xs text-muted-foreground">{token(x.code)}</code></TableCell>
                <TableCell>{x.type === "INITIALS" ? "initials" : "Signature"}</TableCell>
                <TableCell>{x.miscCharge?.name ?? ""}</TableCell>
                <TableCell>{x.insurance?.name ?? ""}</TableCell>
                <TableCell>{CONDITIONS.find((c) => c.value === x.condition)?.label}</TableCell>
                <TableCell>{date(x.effectiveDate)}</TableCell>
                <TableCell>{date(x.endDate)}</TableCell>
                <TableCell>{x.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  {dialog(x)}
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${x.name}`} disabled={!can("AgreementFormsDelete")} title={can("AgreementFormsDelete") ? undefined : NO_PERMISSION} onClick={() => setDeleting({ id: x.id, name: x.name })}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(op) => !op && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Printouts stop showing it."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.template.signatureDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
