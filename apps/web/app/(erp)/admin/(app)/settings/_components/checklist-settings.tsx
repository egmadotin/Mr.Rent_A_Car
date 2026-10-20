"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { Field, FormDialog, SelectField, TextareaField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > Vehicle CheckList and Vehicle CheckList Items (RentCentric VehicleCheckListMain / VehicleCheckListItemsMain). */

const COLORS = [{ value: "NONE", label: "No Color" }, { value: "RED", label: "Red" }, { value: "GREEN", label: "Green" }];
const colorBadge = (c: string) => (c === "RED" ? <Badge variant="destructive">Red</Badge> : c === "GREEN" ? <Badge variant="success">Green</Badge> : null);

/** "All Vehicle Types" + one tick per type; submitted as the hidden `vehicleTypeIds` JSON (empty = all). */
function VehicleTypesField({ value }: { value: string[] }) {
  const trpc = useTRPC();
  const types = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.vehicleTypes ?? [];
  const [ids, setIds] = React.useState<string[]>(value);
  const all = ids.length === 0;
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium">Vehicle Types</legend>
      <input type="hidden" name="vehicleTypeIds" value={JSON.stringify(ids)} />
      <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={all} onChange={(e) => e.target.checked && setIds([])} /> All Vehicle Types</label>
      <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
        {types.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={!all && ids.includes(t.id)} onChange={(e) => { const on = e.target.checked; setIds((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id))); }} /> {t.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
const typeIds = (v: unknown) => (typeof v === "string" && v ? (JSON.parse(v) as string[]) : []);

function useTypeNames() {
  const trpc = useTRPC();
  const types = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.vehicleTypes ?? [];
  return (ids: string[]) => (ids.length === 0 ? "All" : ids.map((id) => types.find((t) => t.id === id)?.name ?? "").filter(Boolean).join(", "));
}

function Delete({ label, disabled, onDelete }: { label: string; disabled: boolean; onDelete: () => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${label}`} disabled={disabled} title={disabled ? NO_PERMISSION : undefined} onClick={() => setOpen(true)}><Trash2Icon /></Button>
      <ConfirmAction open={open} onOpenChange={setOpen} title={`Delete ${label}?`} description="This can't be undone." confirmLabel="Delete" destructive onConfirm={() => onDelete().catch((e) => toast.error(errorMessage(e)))} />
    </>
  );
}

export function ChecklistList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const names = useTypeNames();
  const { data } = useQuery(trpc.staff.checklists.list.queryOptions());
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.checklists.pathKey() });
  const editable = can("Settings");
  type C = NonNullable<typeof data>[number];
  const dialog = (x?: C) => (
    <FormDialog
      title={x ? "Edit Vehicle CheckList" : "New Vehicle CheckList"}
      wide
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`}><PencilIcon /></Button> : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Vehicle CheckList</Button>}
      onSubmit={async (v) => {
        await client.staff.checklists.save.mutate({ id: x?.id, name: String(v.name ?? ""), vehicleTypeIds: typeIds(v.vehicleTypeIds), memo: v.memo as string });
        await refresh();
      }}
    >
      <Field label="Vehicle CheckList Name" name="name" required defaultValue={x?.name} />
      <VehicleTypesField value={x?.vehicleTypeIds ?? []} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={x?.memo ?? ""} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Vehicle CheckList Name</TableHead><TableHead>Vehicle Types</TableHead><TableHead className="text-right">Items</TableHead><TableHead>Memo</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell className="max-w-64 truncate">{names(x.vehicleTypeIds)}</TableCell>
                <TableCell className="text-right tabular-nums">{x.items.length}</TableCell>
                <TableCell className="max-w-64 truncate">{x.memo}</TableCell>
                <TableCell className="flex justify-end">
                  {editable && dialog(x)}
                  <Delete label={x.name} disabled={!editable} onDelete={() => client.staff.checklists.delete.mutate({ id: x.id }).then(refresh)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export function ChecklistItemsList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const names = useTypeNames();
  const { data } = useQuery(trpc.staff.checklists.list.queryOptions());
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.checklists.pathKey() });
  const editable = can("Settings");
  const lists = (data ?? []).map((c) => ({ value: c.id, label: c.name }));
  type I = NonNullable<typeof data>[number]["items"][number];
  const dialog = (x?: I) => (
    <FormDialog
      title={x ? "Edit Vehicle CheckList Item" : "New Vehicle CheckList Item"}
      wide
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`}><PencilIcon /></Button> : <Button disabled={!editable || !lists.length} title={!editable ? NO_PERMISSION : !lists.length ? "Add a Vehicle CheckList first" : undefined}><PlusIcon /> New Vehicle CheckList Item</Button>}
      onSubmit={async (v) => {
        await client.staff.checklists.saveItem.mutate({ id: x?.id, checklistId: String(v.checklistId ?? ""), name: String(v.name ?? ""), statusColor: (v.statusColor as "NONE") || "NONE", vehicleTypeIds: typeIds(v.vehicleTypeIds), memo: v.memo as string });
        await refresh();
      }}
    >
      <SelectField label="Vehicle CheckList Name" name="checklistId" options={lists} required defaultValue={x?.checklistId} />
      <Field label="Vehicle CheckList Item Name" name="name" required defaultValue={x?.name} />
      <SelectField label="Status Color" name="statusColor" options={COLORS} placeholder={false} defaultValue={x?.statusColor ?? "NONE"} />
      <VehicleTypesField value={x?.vehicleTypeIds ?? []} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={x?.memo ?? ""} />
    </FormDialog>
  );
  const rows = (data ?? []).flatMap((c) => c.items.map((i) => ({ ...i, checklistName: c.name })));
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Vehicle CheckList Item Name</TableHead><TableHead>Vehicle CheckList Name</TableHead><TableHead>Status Color</TableHead><TableHead>Vehicle Types</TableHead><TableHead>Memo</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {rows.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell>{x.checklistName}</TableCell>
                <TableCell>{colorBadge(x.statusColor) ?? "No Color"}</TableCell>
                <TableCell className="max-w-64 truncate">{names(x.vehicleTypeIds)}</TableCell>
                <TableCell className="max-w-64 truncate">{x.memo}</TableCell>
                <TableCell className="flex justify-end">
                  {editable && dialog(x)}
                  <Delete label={x.name} disabled={!editable} onDelete={() => client.staff.checklists.deleteItem.mutate({ id: x.id }).then(refresh)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
