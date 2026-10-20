"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { money } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, TextareaField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > One Way Regions (LocationRegionsMain.aspx) and One Way Rates (OneWay.aspx / OneWaysModify.aspx). */

const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const us = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { timeZone: "UTC" });

function Delete({ label, disabled, onDelete }: { label: string; disabled: boolean; onDelete: () => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={`Delete ${label}`} disabled={disabled} title={disabled ? NO_PERMISSION : undefined} onClick={() => setOpen(true)}><Trash2Icon /></Button>
      <ConfirmAction open={open} onOpenChange={setOpen} title={`Delete ${label}?`} description="This cannot be undone." confirmLabel="Delete" destructive onConfirm={() => onDelete().catch((e) => toast.error(errorMessage(e)))} />
    </>
  );
}

export function OneWayRegionsList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.oneWayRegions.queryOptions());
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.pathKey() });
  const editable = can("Settings");
  type R = NonNullable<typeof data>[number];
  const dialog = (x?: R) => (
    <FormDialog
      title={x ? "Edit One Way Region" : "New One Way Region"}
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} disabled={!editable}><PencilIcon /></Button> : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New One Way Region</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.oneWayRegionSave.mutate({ id: x?.id, name: String(v.name ?? "") });
        await refresh();
      }}
    >
      <Field label="Region" name="name" required defaultValue={x?.name} full />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="max-w-3xl gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Region</TableHead><TableHead>Locations</TableHead><TableHead className="text-right">One Way Rates</TableHead><TableHead className="w-20">Delete</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell className="text-muted-foreground">{x.locations.map((l) => l.name).join(", ") || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{x._count.ratesFrom + x._count.ratesTo}</TableCell>
                <TableCell className="flex justify-end">{dialog(x)}<Delete label={x.name} disabled={!editable} onDelete={() => client.staff.setup.oneWayRegionDelete.mutate({ id: x.id }).then(refresh)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-sm text-muted-foreground">Each location&apos;s region is set on Settings › Locations.</p>
    </div>
  );
}

export function OneWayRatesList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const [typeId, setTypeId] = React.useState("");
  const { data } = useQuery(trpc.staff.setup.oneWayRates.queryOptions({ vehicleTypeId: typeId || undefined }));
  const regions = (useQuery(trpc.staff.setup.oneWayRegions.queryOptions()).data ?? []).map((r) => ({ value: r.id, label: r.name }));
  const types = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.vehicleTypes ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.pathKey() });
  const editable = can("Settings");
  type R = NonNullable<typeof data>[number];
  const n = (v: unknown) => (v == null ? "" : String(v));
  const dialog = (x?: R) => (
    <FormDialog
      title={x ? "Edit One Way" : "New One Way"}
      wide
      trigger={x ? <Button size="icon-sm" variant="ghost" aria-label="Edit one way rate" disabled={!editable}><PencilIcon /></Button> : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New One Way</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.oneWayRateSave.mutate({
          id: x?.id, fromRegionId: String(v.fromRegionId ?? ""), toRegionId: String(v.toRegionId ?? ""), addReverse: !!v.addReverse, fee: v.fee as never,
          odometer: v.odometer as never, numberOfDays: v.numberOfDays as never, vehicleTypeId: (v.vehicleTypeId as string) || null,
          competitionRate1: v.competitionRate1 as never, competitionRate2: v.competitionRate2 as never, competitionRate3: v.competitionRate3 as never,
          startDate: v.startDate as never, endDate: v.endDate as never, memo: v.memo as string,
        });
        await refresh();
      }}
    >
      <SelectField label="One Way From" name="fromRegionId" options={regions} required placeholder="Please Select" defaultValue={x?.fromRegionId} />
      <SelectField label="One Way To" name="toRegionId" options={regions} required placeholder="Please Select" defaultValue={x?.toRegionId} />
      {!x && <div className="flex items-end sm:col-span-2"><CheckField label="Add Reverse (the same fee the other way)" name="addReverse" /></div>}
      <Field label="Fee" name="fee" type="number" min={0} step="0.01" required defaultValue={n(x?.fee)} />
      <SelectField label="Vehicle Type" name="vehicleTypeId" options={types.map((t) => ({ value: t.id, label: t.name }))} placeholder="All" defaultValue={x?.vehicleTypeId ?? ""} />
      <Field label="Odometer" name="odometer" type="number" min={0} defaultValue={n(x?.odometer)} />
      <Field label="Number Of Days" name="numberOfDays" type="number" min={0} defaultValue={n(x?.numberOfDays)} />
      <Field label="Competition Rate 1" name="competitionRate1" type="number" min={0} step="0.01" defaultValue={n(x?.competitionRate1)} />
      <Field label="Competition Rate 2" name="competitionRate2" type="number" min={0} step="0.01" defaultValue={n(x?.competitionRate2)} />
      <Field label="Competition Rate 3" name="competitionRate3" type="number" min={0} step="0.01" defaultValue={n(x?.competitionRate3)} />
      <Field label="Start Date" name="startDate" type="date" required defaultValue={ymd(x?.startDate)} />
      <Field label="End Date" name="endDate" type="date" required defaultValue={ymd(x?.endDate)} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={x?.memo ?? ""} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          Vehicle Type
          <NativeSelect value={typeId} onChange={(e) => setTypeId(e.target.value)} className="w-56" aria-label="Filter by vehicle type">
            <option value="">All</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </label>
        {dialog()}
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>One Way From</TableHead><TableHead>One Way To</TableHead><TableHead className="text-right">Fee</TableHead><TableHead>Vehicle Type</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead className="w-20">Delete</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.fromRegion.name}</TableCell>
                <TableCell>{x.toRegion.name}</TableCell>
                <TableCell className="text-right tabular-nums">{money(x.fee)}</TableCell>
                <TableCell>{x.vehicleType?.name ?? ""}</TableCell>
                <TableCell>{us(x.startDate)}</TableCell>
                <TableCell>{us(x.endDate)}</TableCell>
                <TableCell className="flex justify-end">{dialog(x)}<Delete label="this one way rate" disabled={!editable} onDelete={() => client.staff.setup.oneWayRateDelete.mutate({ id: x.id }).then(refresh)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
