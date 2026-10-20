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
import { CheckField, Field, FormDialog, SelectField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Promotions/Specials (DiscountPromoMain: Promo Code, Category, Start / End / Expiration Date, Discount Type / Value,
 * Km Discount Type / Value, Minimum Days, Status, Auto Apply, One Time Use). A code entered on an online booking
 * becomes its discount when it applies (see lib/promo.ts).
 */

const TYPES = [{ value: "PERCENT", label: "Percentage" }, { value: "AMOUNT", label: "Amount" }];
const us = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC" }) : "");
const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const typeLabel = (t: string | null | undefined) => TYPES.find((x) => x.value === t)?.label ?? "";

/** "All …" + one tick each; submitted as the hidden JSON field `name` (empty = all). */
function TickList({ name, label, items, value }: { name: string; label: string; items: { id: string; name: string }[]; value: string[] }) {
  const [ids, setIds] = React.useState<string[]>(value);
  const all = ids.length === 0;
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={JSON.stringify(ids)} />
      <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={all} onChange={(e) => e.target.checked && setIds([])} /> All</label>
      <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
        {items.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={!all && ids.includes(t.id)} onChange={(e) => { const on = e.target.checked; setIds((x) => (on ? [...x, t.id] : x.filter((y) => y !== t.id))); }} /> {t.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
const ids = (v: unknown) => (typeof v === "string" && v ? (JSON.parse(v) as string[]) : []);

export function PromoSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.promoList.queryOptions());
  const o = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data;
  const [deleting, setDeleting] = React.useState<{ id: string; code: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.promoList.queryKey() });
  const editable = can("Settings");
  type P = NonNullable<typeof data>[number];
  const dialog = (x?: P) => (
    <FormDialog
      title={x ? `Edit ${x.code}` : "New Promotion"}
      wide
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.code}`} disabled={!editable}><PencilIcon /></Button> : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Promotion</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.promoSave.mutate({
          id: x?.id, category: (v.category as "RESERVATION") || "RESERVATION", code: String(v.code ?? ""), startDate: v.startDate as never, endDate: v.endDate as never,
          expirationDate: (v.expirationDate as never) ?? null, discountType: v.discountType as "PERCENT", discountValue: v.discountValue as never,
          kmDiscountType: (v.kmDiscountType as never) ?? null, kmDiscountValue: v.kmDiscountValue as never, minDays: (v.minDays as never) || 1,
          isActive: v.status !== "INACTIVE", autoApply: !!v.autoApply, oneTimeUse: !!v.oneTimeUse, locationIds: ids(v.locationIds), vehicleTypeIds: ids(v.vehicleTypeIds),
        });
        await refresh();
      }}
    >
      <SelectField label="Category" name="category" options={[{ value: "RESERVATION", label: "Reservation" }, { value: "REGISTRATION", label: "Registration" }]} placeholder={false} defaultValue={x?.category ?? "RESERVATION"} />
      <Field label="Promotion Code" name="code" required defaultValue={x?.code} />
      <Field label="Start Date" name="startDate" type="date" required defaultValue={ymd(x?.startDate)} />
      <Field label="End Date" name="endDate" type="date" required defaultValue={ymd(x?.endDate)} />
      <Field label="Expiration Date" name="expirationDate" type="date" defaultValue={ymd(x?.expirationDate)} hint="Last day the code can be booked (optional)." />
      <Field label="Minimum Days" name="minDays" type="number" min={1} defaultValue={x?.minDays ?? 1} />
      <SelectField label="Discount Type" name="discountType" options={TYPES} required placeholder="- Select -" defaultValue={x?.discountType ?? ""} />
      <Field label="Discount Value" name="discountValue" type="number" min={0} step="0.01" required defaultValue={x ? String(x.discountValue) : ""} />
      <SelectField label="KM Discount Type" name="kmDiscountType" options={TYPES} placeholder="- Select -" defaultValue={x?.kmDiscountType ?? ""} />
      <Field label="KM Discount Value" name="kmDiscountValue" type="number" min={0} step="0.01" defaultValue={x?.kmDiscountValue != null ? String(x.kmDiscountValue) : ""} />
      <SelectField label="Status" name="status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} placeholder={false} defaultValue={x && !x.isActive ? "INACTIVE" : "ACTIVE"} />
      <div className="flex items-end gap-6">
        <CheckField label="Auto Apply" name="autoApply" defaultChecked={x?.autoApply ?? true} />
        <CheckField label="One Time Use" name="oneTimeUse" defaultChecked={x?.oneTimeUse ?? false} />
      </div>
      <TickList name="locationIds" label="Locations" items={o?.locations ?? []} value={x?.locationIds ?? []} />
      <TickList name="vehicleTypeIds" label="Vehicle Types" items={o?.vehicleTypes ?? []} value={x?.vehicleTypeIds ?? []} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Promo Code</TableHead><TableHead>Category</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Expiration Date</TableHead>
              <TableHead>Discount Type</TableHead><TableHead className="text-right">Discount Value</TableHead><TableHead>Km Discount Type</TableHead><TableHead className="text-right">Km Discount Value</TableHead>
              <TableHead className="text-right">Minimum Days</TableHead><TableHead>Status</TableHead><TableHead>Auto Apply</TableHead><TableHead>One Time Use</TableHead><TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.code}</TableCell>
                <TableCell>{x.category === "REGISTRATION" ? "Registration" : "Reservation"}</TableCell>
                <TableCell>{us(x.startDate)}</TableCell>
                <TableCell>{us(x.endDate)}</TableCell>
                <TableCell>{us(x.expirationDate)}</TableCell>
                <TableCell>{typeLabel(x.discountType)}</TableCell>
                <TableCell className="text-right tabular-nums">{String(Number(x.discountValue))}</TableCell>
                <TableCell>{typeLabel(x.kmDiscountType)}</TableCell>
                <TableCell className="text-right tabular-nums">{x.kmDiscountValue != null ? String(Number(x.kmDiscountValue)) : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{x.minDays}</TableCell>
                <TableCell>{x.isActive ? "Active" : <Badge variant="muted">Inactive</Badge>}</TableCell>
                <TableCell>{x.autoApply ? "Yes" : "No"}</TableCell>
                <TableCell>{x.oneTimeUse ? "Yes" : "No"}</TableCell>
                <TableCell className="flex justify-end">
                  {dialog(x)}
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${x.code}`} disabled={!editable} title={editable ? undefined : NO_PERMISSION} onClick={() => setDeleting({ id: x.id, code: x.code })}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(op) => !op && setDeleting(null)}
        title={`Delete ${deleting?.code}?`}
        description="Only a code never used on a reservation can be deleted; otherwise set it Inactive."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.setup.promoDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
