"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { RouterOutputs } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, fromDateTimeLocal, toDateTimeLocal } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { ConfirmAction } from "./confirm-action";
import { Field, FormDialog, SelectField, TextareaField, errorMessage } from "./form";

/**
 * Vehicle page › Vehicle Checklist (VehicleCheckListOutReturnMain: Pickup Date, Return Date, Milage, Delivery Or PickUp,
 * Memo, DateEntered, Edit, Delete) and its form (VehicleCheckListOutReturnModify: Reservation #, Full Name, Pickup Date,
 * Return Date, Milage, Delivery Or PickUp, Memo, then Checklist Name / Checklist Items / Note).
 */

const DELIVERY = [{ value: "PICKUP", label: "PickUp" }, { value: "DELIVERY", label: "Delivery" }];
const dot = (c: string) => (c === "RED" ? "bg-destructive" : c === "GREEN" ? "bg-success" : "bg-transparent");

export function VehicleChecklistPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const data = useQuery(trpc.staff.checklists.forVehicle.queryOptions({ vehicleId })).data;
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.checklists.pathKey() });
  if (!data) return null;
  const rec = editing && editing !== "new" ? data.records.find((r) => r.id === editing) : undefined;

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="font-serif text-lg">Vehicle Checklist</CardTitle>
        <Button size="sm" onClick={() => setEditing("new")} disabled={!data.checklists.length} title={data.checklists.length ? undefined : "Set up a Vehicle CheckList for this vehicle type first (Settings › Vehicle CheckList)"}>
          <PlusIcon /> New Vehicle CheckList
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {data.records.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No Records Found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Pickup Date</TableHead><TableHead>Return Date</TableHead><TableHead>Milage</TableHead><TableHead>Delivery Or PickUp</TableHead><TableHead>Memo</TableHead><TableHead>DateEntered</TableHead><TableHead className="w-20" /></TableRow>
            </TableHeader>
            <TableBody>
              {data.records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{dateTime(r.pickupAt)}</TableCell>
                  <TableCell>{dateTime(r.returnAt)}</TableCell>
                  <TableCell className="tabular-nums">{r.mileage?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell>{r.deliveryOrPickup === "DELIVERY" ? "Delivery" : "PickUp"}</TableCell>
                  <TableCell className="max-w-64 truncate">{r.memo}</TableCell>
                  <TableCell>{dateTime(r.createdAt)}</TableCell>
                  <TableCell className="flex justify-end">
                    <Button size="icon-sm" variant="ghost" aria-label="Edit checklist" onClick={() => setEditing(r.id)}><PencilIcon /></Button>
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete checklist" onClick={() => setDeleting(r.id)}><Trash2Icon /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {editing && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title="Vehicle CheckList"
          wide
          onSubmit={async (v) => {
            const items = data.checklists.flatMap((c) => c.items);
            await client.staff.checklists.saveRecord.mutate({
              id: rec?.id, vehicleId, reservationId: (v.reservationId as string) || null,
              pickupAt: v.pickupAt ? fromDateTimeLocal(String(v.pickupAt)) : (undefined as never), returnAt: v.returnAt ? fromDateTimeLocal(String(v.returnAt)) : (undefined as never),
              mileage: v.mileage as never, deliveryOrPickup: (v.deliveryOrPickup as "PICKUP") || "PICKUP", memo: v.memo as string,
              results: items.map((i) => ({ itemId: i.id, checked: !!v[`chk_${i.id}`], note: (v[`note_${i.id}`] as string) || null })),
            });
            await refresh();
          }}
        >
          <RecordFields data={data} rec={rec} />
        </FormDialog>
      )}
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title="Delete this vehicle checklist?"
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => client.staff.checklists.deleteRecord.mutate({ id: deleting! }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </Card>
  );
}

type Data = RouterOutputs["staff"]["checklists"]["forVehicle"];

function RecordFields({ data, rec }: { data: Data; rec?: Data["records"][number] }) {
  const [resId, setResId] = React.useState(rec?.reservationId ?? "");
  const res = data.reservations.find((r) => r.id === resId);
  const [pickup, setPickup] = React.useState(rec ? toDateTimeLocal(new Date(rec.pickupAt)) : toDateTimeLocal(new Date()));
  const [ret, setRet] = React.useState(rec ? toDateTimeLocal(new Date(rec.returnAt)) : "");
  const result = (itemId: string) => rec?.results.find((x) => x.itemId === itemId);
  return (
    <>
      <SelectField
        label="Reservation #"
        name="reservationId"
        options={data.reservations.map((r) => ({ value: r.id, label: String(r.number) }))}
        placeholder=""
        value={resId}
        onChange={(e) => {
          setResId(e.target.value);
          const r = data.reservations.find((x) => x.id === e.target.value);
          if (r) {
            setPickup(toDateTimeLocal(new Date(r.pickupAt)));
            setRet(toDateTimeLocal(new Date(r.returnAt)));
          }
        }}
      />
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Full Name</span>
        <p className="py-2 text-sm">{res ? <Link className="text-primary hover:underline" href={`/admin/reservations/${res.id}`}>{res.firstName} {res.lastName}</Link> : "—"}</p>
      </div>
      <Field label="Pickup Date" name="pickupAt" type="datetime-local" required value={pickup} onChange={(e) => setPickup(e.target.value)} />
      <Field label="Return Date" name="returnAt" type="datetime-local" required value={ret} onChange={(e) => setRet(e.target.value)} />
      <Field label="Milage" name="mileage" type="number" min={0} defaultValue={rec ? (rec.mileage ?? "") : (data.odometer ?? "")} />
      <SelectField label="Delivery Or PickUp" name="deliveryOrPickup" options={DELIVERY} placeholder={false} defaultValue={rec?.deliveryOrPickup ?? "PICKUP"} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={rec?.memo ?? ""} />
      <div className="overflow-x-auto rounded-md border sm:col-span-2">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-2 py-1.5 font-medium">Checklist Name</th><th className="px-2 py-1.5 font-medium">Checklist Items</th><th className="px-2 py-1.5 font-medium">Note</th></tr>
          </thead>
          <tbody>
            {data.checklists.flatMap((c) =>
              c.items.map((i, n) => (
                <tr key={i.id} className="border-t">
                  <td className="px-2 py-1 align-top font-medium">{n === 0 ? c.name : ""}</td>
                  <td className="px-2 py-1">
                    <label className="flex items-center gap-2">
                      <Checkbox name={`chk_${i.id}`} defaultChecked={result(i.id)?.checked} />
                      <span className={cn("size-2.5 rounded-full", dot(i.statusColor))} aria-hidden />
                      {i.name}
                    </label>
                  </td>
                  <td className="px-2 py-1"><Input name={`note_${i.id}`} aria-label={`Note for ${i.name}`} defaultValue={result(i.id)?.note ?? ""} className="h-8" /></td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
