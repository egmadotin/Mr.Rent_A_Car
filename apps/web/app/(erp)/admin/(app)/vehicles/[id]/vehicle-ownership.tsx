"use client";

import * as React from "react";
import Link from "next/link";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { ACQUISITION_TYPES, CONDITION_COMPONENTS, CONDITION_RATINGS, OWNERSHIP_FIELDS, SOLD_METHODS } from "@mrac/api/vehicle-ownership-fields";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Textarea } from "@mrac/ui/components/textarea";
import { date } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FieldShell as F, FormDialog, FormErrorsContext, SelectField, TextareaField, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Ownership Information (VehicleLeaseInfo.aspx): every field in RentCentric's order, saved with "Save". */
export function OwnershipPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.vehicleRecords.ownershipGet.queryOptions({ vehicleId }));
  const companies = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.companies ?? [];
  // Settings › Registered Owners / Title Locations, offered as suggestions (the fields stay free text)
  const owners = useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "REGISTERED_OWNER" })).data ?? [];
  const titles = useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "TITLE_LOCATION" })).data ?? [];
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = React.useState(false);
  if (q.isLoading) return null;
  const row = (q.data ?? {}) as Record<string, unknown>;
  const editable = can("VehiclesEdit");

  const initial = (k: string, kind: string) => {
    const v = row[k];
    if (v == null) return "";
    if (kind === "date") return new Date(v as string).toISOString().slice(0, 10);
    return String(v);
  };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(OWNERSHIP_FIELDS.map(([k, , kind]) => [k, kind === "bool" ? fd.get(k) === "on" : String(fd.get(k) ?? "")]));
    setSaving(true);
    setErrors({});
    try {
      await client.staff.vehicleRecords.ownershipSave.mutate({ vehicleId, data } as never);
      await qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.ownershipGet.queryKey({ vehicleId }) });
      toast.success("Ownership Information saved");
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(fieldErrorsOf(err)).map(([k, v]) => [k.replace(/^data\./, ""), v])));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">Ownership Information</CardTitle></CardHeader>
      <CardContent className="px-4">
        <FormErrorsContext.Provider value={errors}>
          <form onSubmit={save} noValidate>
            <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {OWNERSHIP_FIELDS.map(([k, label, kind]) => {
                const dv = initial(k, kind);
                let input: React.ReactNode;
                if (kind === "bool") input = <label className="flex h-9 items-center gap-2 text-sm"><Checkbox id={k} name={k} defaultChecked={row[k] === true} /> Yes</label>;
                else if (kind === "long") input = <Textarea id={k} name={k} rows={2} defaultValue={dv} />;
                else if (kind === "acq" || kind === "sold" || kind === "state" || kind === "company") {
                  const opts = kind === "acq" ? ACQUISITION_TYPES.map((x) => [x, x]) : kind === "sold" ? SOLD_METHODS.map((x) => [x, x]) : kind === "state" ? REGION_OPTIONS.map((x) => [x, x]) : companies.map((c) => [c.id, c.name]);
                  input = (
                    <NativeSelect id={k} name={k} defaultValue={dv}>
                      <option value="">{kind === "company" ? "None" : ""}</option>
                      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </NativeSelect>
                  );
                } else {
                  const list = k === "registeredOwner" ? "own-owners" : k === "titleLocation" ? "own-titles" : undefined;
                  input = <Input id={k} name={k} list={list} type={kind === "date" ? "date" : kind === "text" ? "text" : "number"} step={kind === "money" ? "0.01" : kind === "num" ? "any" : undefined} defaultValue={dv} />;
                }
                return <F key={k} label={label} name={k} className={kind === "long" ? "sm:col-span-2" : undefined}>{input}</F>;
              })}
            </fieldset>
            <datalist id="own-owners">{owners.filter((o) => o.isActive).map((o) => <option key={o.id} value={o.name} />)}</datalist>
            <datalist id="own-titles">{titles.filter((o) => o.isActive).map((o) => <option key={o.id} value={o.name} />)}</datalist>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </FormErrorsContext.Provider>
      </CardContent>
    </Card>
  );
}

/** Vehicle Condition (VehicleConditions.aspx): Component/Condition grid of ticks, then Special Comment 1-4. */
export function ConditionPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.vehicleRecords.conditionGet.queryOptions({ vehicleId }));
  const [saving, setSaving] = React.useState(false);
  if (q.isLoading) return null;
  const ratings = (q.data?.ratings ?? {}) as Record<string, string[]>;
  const editable = can("VehiclesEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = Object.fromEntries(CONDITION_COMPONENTS.map((c) => [c, CONDITION_RATINGS.map(([k]) => k).filter((k) => fd.get(`${c}|${k}`) === "on")]));
    setSaving(true);
    try {
      await client.staff.vehicleRecords.conditionSave.mutate({
        vehicleId, ratings: r as never,
        comment1: String(fd.get("comment1") ?? ""), comment2: String(fd.get("comment2") ?? ""), comment3: String(fd.get("comment3") ?? ""), comment4: String(fd.get("comment4") ?? ""),
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.conditionGet.queryKey({ vehicleId }) });
      toast.success("Vehicle Condition saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">Vehicle Condition</CardTitle></CardHeader>
      <CardContent className="px-4">
        <form onSubmit={save}>
          <fieldset disabled={!editable} className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr><th className="px-2 py-1.5 text-left font-medium">Component/Condition</th>{CONDITION_RATINGS.map(([k, l]) => <th key={k} className="px-2 py-1.5 font-medium">{l}</th>)}</tr>
                </thead>
                <tbody>
                  {CONDITION_COMPONENTS.map((c) => (
                    <tr key={c} className="border-t">
                      <td className="px-2 py-1">{c}</td>
                      {CONDITION_RATINGS.map(([k, l]) => (
                        <td key={k} className="px-2 py-1 text-center"><Checkbox name={`${c}|${k}`} aria-label={`${c}: ${l}`} defaultChecked={ratings[c]?.includes(k)} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => (
                <F key={n} label={`Special Comment ${n}`} name={`comment${n}`}><Textarea id={`comment${n}`} name={`comment${n}`} rows={2} defaultValue={q.data?.[`comment${n}`] ?? ""} /></F>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const CLAIM_TYPES = [{ value: "RENTER", label: "Renter" }, { value: "THIRD_PARTY", label: "3rd Party" }, { value: "OTHER", label: "Other" }];
const CLAIM_STATUS = [{ value: "OPEN", label: "Open" }, { value: "PENDING", label: "Pending" }, { value: "CLOSED", label: "Closed" }];
const ymdOf = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Vehicle Claims (ClaimsMain.aspx?VehicleID=…: Claim ID (Status), Claim Date, Claim Close Date + New Claim). */
export function VehicleClaimsPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const rows = useQuery(trpc.staff.vehicleRecords.claims.queryOptions({ vehicleId })).data;
  const rentals = (useQuery(trpc.staff.inspections.bookings.queryOptions({ vehicleId })).data?.rentals ?? []).map((r) => ({ value: r.id, label: `Rental# ${r.raNumber} — ${r.customer.firstName} ${r.customer.lastName}` }));
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.claims.queryKey({ vehicleId }) });
  type C = NonNullable<typeof rows>[number];
  const dialog = (c?: C) => (
    <FormDialog
      title={c ? "Edit Claim" : "New Claim"}
      wide
      trigger={c ? <Button size="icon-sm" variant="ghost" aria-label="Edit claim" disabled={!can("ClaimsEdit")}><PencilIcon /></Button> : <Button size="sm" disabled={!can("ClaimsAdd")} title={can("ClaimsAdd") ? undefined : NO_PERMISSION}><PlusIcon /> New Claim</Button>}
      onSubmit={async (v) => {
        await client.staff.vehicleRecords.claimSave.mutate({
          id: c?.id, vehicleId, rentalId: (v.rentalId as string) || null, claimDate: v.claimDate as never, claimNumber: v.claimNumber as string, closeDate: (v.closeDate as never) || null,
          type: v.type as "RENTER", location: v.location as string, policeDept: v.policeDept as string, policeRep: v.policeRep as string, status: v.status as "OPEN",
          deductible: v.deductible as never, totalPayments: v.totalPayments as never, memo: v.memo as string,
          hasAccidentReport: !!v.hasAccidentReport, hasRenterInsurancePolicy: !!v.hasRenterInsurancePolicy, hasPoliceReport: !!v.hasPoliceReport, hasRentalAgreement: !!v.hasRentalAgreement,
        });
        await refresh();
      }}
    >
      <Field label="Claim Date" name="claimDate" type="date" required defaultValue={ymdOf(c?.claimDate)} />
      <Field label="Claim #" name="claimNumber" defaultValue={c?.claimNumber ?? ""} />
      <Field label="Claim Close Date" name="closeDate" type="date" defaultValue={ymdOf(c?.closeDate)} />
      <SelectField label="Rental #" name="rentalId" options={rentals} placeholder="" defaultValue={c?.rentalId ?? ""} />
      <SelectField label="Claim Type" name="type" options={CLAIM_TYPES} placeholder={false} defaultValue={c?.type ?? "RENTER"} />
      <SelectField label="Current Status" name="status" options={CLAIM_STATUS} placeholder={false} defaultValue={c?.status ?? "OPEN"} />
      <Field label="Location" name="location" defaultValue={c?.location ?? ""} />
      <Field label="Police Dept." name="policeDept" defaultValue={c?.policeDept ?? ""} />
      <Field label="Police Rep." name="policeRep" defaultValue={c?.policeRep ?? ""} />
      <Field label="Deductible" name="deductible" type="number" min={0} step="0.01" defaultValue={c?.deductible != null ? String(c.deductible) : ""} />
      <Field label="Total Payments" name="totalPayments" type="number" min={0} step="0.01" defaultValue={c?.totalPayments != null ? String(c.totalPayments) : ""} />
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Documents on file</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <CheckField label="Accident Report" name="hasAccidentReport" defaultChecked={c?.hasAccidentReport} />
          <CheckField label="Renter Insurance Policy" name="hasRenterInsurancePolicy" defaultChecked={c?.hasRenterInsurancePolicy} />
          <CheckField label="Police Report" name="hasPoliceReport" defaultChecked={c?.hasPoliceReport} />
          <CheckField label="Rental Agreement" name="hasRentalAgreement" defaultChecked={c?.hasRentalAgreement} />
        </div>
      </fieldset>
      <TextareaField label="Memo" name="memo" rows={3} defaultValue={c?.memo ?? ""} />
    </FormDialog>
  );
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="font-serif text-lg">Claims</CardTitle>
        {dialog()}
      </CardHeader>
      <CardContent className="px-0">
        {!rows ? null : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No Records Found</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Claim ID (Status)</TableHead><TableHead>Claim Date</TableHead><TableHead>Claim Close Date</TableHead><TableHead>Rental #</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.claimNumber || "—"} ({CLAIM_STATUS.find((x) => x.value === c.status)?.label})</TableCell>
                  <TableCell>{date(c.claimDate)}</TableCell>
                  <TableCell>{date(c.closeDate)}</TableCell>
                  <TableCell>{c.rental ? <Link className="text-primary hover:underline" href={`/admin/rentals/${c.rental.id}`}>{c.rental.raNumber}</Link> : "—"}</TableCell>
                  <TableCell className="flex justify-end">
                    {dialog(c)}
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete claim" disabled={!can("ClaimsDelete")} title={can("ClaimsDelete") ? undefined : NO_PERMISSION} onClick={() => setDeleting(c.id)}><Trash2Icon /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ConfirmAction open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)} destructive title="Delete this claim?" description="This cannot be undone." confirmLabel="Delete" onConfirm={() => client.staff.vehicleRecords.claimDelete.mutate({ id: deleting! }).then(refresh, (e) => toast.error(errorMessage(e)))} />
      </CardContent>
    </Card>
  );
}
