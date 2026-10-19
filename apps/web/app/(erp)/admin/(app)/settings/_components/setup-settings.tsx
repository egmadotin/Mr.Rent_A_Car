"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import type { RouterOutputs } from "@mrac/api";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

const s = (v: unknown) => (v == null ? "" : String(v));
const editIcon = (label: string) => <Button size="icon-sm" variant="ghost" aria-label={`Edit ${label}`}><PencilIcon /></Button>;

/** Delete button with a confirm step; the server refuses (and says why) when the record is in use. */
function DeleteButton({ label, disabled, onDelete }: { label: string; disabled?: boolean; onDelete: () => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${label}`} disabled={disabled} title={disabled ? NO_PERMISSION : undefined} onClick={() => setOpen(true)}>
        <Trash2Icon />
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${label}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await onDelete();
            toast.success(`${label} deleted`);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </>
  );
}

// ── Pick lists ───────────────────────────────────────────────────────────────

export type LookupKind = "VEHICLE_CATEGORY" | "VEHICLE_BODY" | "FUEL_TYPE" | "ENGINE_BRAND" | "ENGINE_TYPE" | "VEHICLE_OPTION" | "COMPANY_TYPE" | "CUSTOMER_REGION" | "DISCOUNT_REASON" | "RENTAL_REASON" | "PAYMENT_DETAIL";

/** One simple name list (Categories, Body Types, Fuel Types, Company Type, Customer Areas/Regions, …). */
export function PickList({ kind, noun }: { kind: LookupKind; noun: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data, error } = useQuery(trpc.staff.setup.lookupList.queryOptions({ kind }));
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.lookupList.queryKey({ kind }) });
  const editable = can("Settings");
  type L = NonNullable<typeof data>[number];
  const dialog = (l?: L) => (
    <FormDialog
      title={l ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}
      trigger={l ? editIcon(l.name) : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add New</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.lookupSave.mutate({ id: l?.id, kind, name: v.name as string, sortOrder: Number(v.sortOrder || 0), isActive: Boolean(v.isActive) });
        await refresh();
      }}
    >
      <Field label="Name" name="name" required defaultValue={l?.name} />
      <Field label="Sort order" name="sortOrder" type="number" defaultValue={s(l?.sortOrder ?? 0)} />
      <CheckField label="Active" name="isActive" defaultChecked={l?.isActive ?? true} />
    </FormDialog>
  );
  if (error) return <p className="p-6 text-sm text-destructive">{error.message}</p>;
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="max-w-2xl gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>{noun}</TableHead><TableHead className="text-right">Order</TableHead><TableHead>Active</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nothing on this list yet.</TableCell></TableRow>}
            {data?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-right tabular-nums">{l.sortOrder}</TableCell>
                <TableCell>{l.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  {editable && dialog(l)}
                  <DeleteButton label={l.name} disabled={!editable} onDelete={() => client.staff.setup.lookupDelete.mutate({ id: l.id }).then(refresh)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Makes & models ───────────────────────────────────────────────────────────

export function MakesModels() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.makeList.queryOptions());
  const [makeId, setMakeId] = React.useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.makeList.queryKey() });
  const editable = can("VehiclesEdit");
  const make = data?.find((m) => m.id === makeId) ?? data?.[0];
  type M = NonNullable<typeof data>[number];
  const makeDialog = (m?: M) => (
    <FormDialog
      title={m ? "Edit make" : "New make"}
      trigger={m ? editIcon(m.name) : <Button size="sm" variant="ghost" disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add Make</Button>}
      onSubmit={async (v) => {
        const r = await client.staff.setup.makeSave.mutate({ id: m?.id, name: v.name as string });
        await refresh();
        setMakeId(r.id);
      }}
    >
      <Field label="Make" name="name" required defaultValue={m?.name} />
    </FormDialog>
  );
  const modelDialog = (mk: M, x?: M["models"][number]) => (
    <FormDialog
      title={x ? "Edit model" : `New ${mk.name} model`}
      trigger={x ? editIcon(x.name) : <Button size="sm" disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add Model</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.modelSave.mutate({ id: x?.id, makeId: mk.id, name: v.name as string });
        await refresh();
      }}
    >
      <Field label="Model" name="name" required defaultValue={x?.name} />
    </FormDialog>
  );
  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="gap-2 self-start">
        <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Makes</CardTitle>{makeDialog()}</CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto px-2">
          <ul>
            {data?.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setMakeId(m.id)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${make?.id === m.id ? "bg-accent font-medium" : ""}`}>
                  <span>{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.models.length} models · {m._count.vehicles} vehicles</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {make && (
        <Card className="gap-2 self-start py-3">
          <CardHeader className="flex-row items-center justify-between px-4">
            <CardTitle className="flex items-center gap-1 text-base">{make.name} {editable && makeDialog(make)}<DeleteButton label={make.name} disabled={!can("VehiclesDelete")} onDelete={() => client.staff.setup.makeDelete.mutate({ id: make.id }).then(() => { setMakeId(null); return refresh(); })} /></CardTitle>
            {modelDialog(make)}
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Model</TableHead><TableHead className="text-right">Vehicles</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {make.models.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No models yet.</TableCell></TableRow>}
              {make.models.map((x) => (
                <TableRow key={x.id}>
                  <TableCell className="font-medium">{x.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{x._count.vehicles}</TableCell>
                  <TableCell className="flex justify-end">
                    {editable && modelDialog(make, x)}
                    <DeleteButton label={`${make.name} ${x.name}`} disabled={!can("VehiclesDelete")} onDelete={() => client.staff.setup.modelDelete.mutate({ id: x.id }).then(refresh)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ── Companies / corporates ───────────────────────────────────────────────────

type Company = RouterOutputs["staff"]["setup"]["companyGet"];

export function Companies() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const { data, error } = useQuery(trpc.staff.setup.companyList.queryOptions({ q, status }));
  const types = useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "COMPANY_TYPE" })).data ?? [];
  const [editing, setEditing] = React.useState<Company | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.companyList.queryKey() });
  if (error) return <p className="p-6 text-sm text-destructive">{error.message}</p>;
  const c = editing === "new" ? null : editing;
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code, contact or phone" className="pl-8" aria-label="Search companies" />
        </div>
        <NativeSelect className="w-36" value={status} onChange={(e) => setStatus(e.target.value as "ALL")} aria-label="Status">
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALL">All</option>
        </NativeSelect>
        <Button className="ml-auto" onClick={() => setEditing("new")} disabled={!can("CompanyAdd")} title={can("CompanyAdd") ? undefined : NO_PERMISSION}><PlusIcon /> Add Company</Button>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>City</TableHead><TableHead className="text-right">Rentals</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No companies found.</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell>{x.code}</TableCell>
                <TableCell>{x.type?.name}</TableCell>
                <TableCell>{x.contactName}</TableCell>
                <TableCell>{x.phone}</TableCell>
                <TableCell>{x.city}</TableCell>
                <TableCell className="text-right tabular-nums">{x._count.rentals}</TableCell>
                <TableCell className="space-x-1">{x.isActive ? "Active" : <Badge variant="muted">Inactive</Badge>}{x.isUndesired && <Badge variant="destructive">Undesired</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} onClick={() => client.staff.setup.companyGet.query({ id: x.id }).then(setEditing, (e) => toast.error(errorMessage(e)))}><PencilIcon /></Button>
                  <DeleteButton label={x.name} disabled={!can("CompanyDelete")} onDelete={() => client.staff.setup.companyDelete.mutate({ id: x.id }).then(refresh)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editing && (
        <FormDialog
          key={c?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          wide
          title={c ? `Edit ${c.name}` : "Add company"}
          onSubmit={async (v) => {
            await client.staff.setup.companySave.mutate({
              id: c?.id,
              data: { ...v, copyInsuranceToRental: Boolean(v.copyInsuranceToRental), isUndesired: Boolean(v.isUndesired), isActive: Boolean(v.isActive) } as never,
            });
            toast.success("Company saved");
            setEditing(null);
            await refresh();
          }}
        >
          <Field label="Company name" name="name" required defaultValue={s(c?.name)} />
          <SelectField label="Company type" name="typeId" placeholder="None" options={types.filter((t) => t.isActive || t.id === c?.typeId).map((t) => ({ value: t.id, label: t.name }))} defaultValue={s(c?.typeId)} />
          <Field label="Company code" name="code" defaultValue={s(c?.code)} />
          <Field label="Contact name" name="contactName" defaultValue={s(c?.contactName)} />
          <Field label="Address" name="address1" defaultValue={s(c?.address1)} />
          <Field label="Address 2" name="address2" defaultValue={s(c?.address2)} />
          <Field label="City" name="city" defaultValue={s(c?.city)} />
          <Field label="Province / state" name="province" defaultValue={s(c?.province)} />
          <Field label="Postal / zip" name="postal" defaultValue={s(c?.postal)} />
          <Field label="Country" name="country" defaultValue={s(c?.country ?? "Canada")} />
          <Field label="Phone" name="phone" type="tel" defaultValue={s(c?.phone)} />
          <Field label="Fax" name="fax" type="tel" defaultValue={s(c?.fax)} />
          <Field label="Email" name="email" type="email" defaultValue={s(c?.email)} />
          <Field label="Claims office" name="claimsOffice" defaultValue={s(c?.claimsOffice)} />
          <Field label="Tax name" name="taxName" defaultValue={s(c?.taxName)} />
          <Field label="Tax ID" name="taxId" defaultValue={s(c?.taxId)} />
          <Field label="Tax address" name="taxAddress" defaultValue={s(c?.taxAddress)} full />
          <Field label="Minimum age" name="minimumAge" type="number" min={0} defaultValue={s(c?.minimumAge)} />
          <Field label="Mileage cap (km)" name="mileageCap" type="number" min={0} defaultValue={s(c?.mileageCap)} />
          <Field label="Insurance company" name="insuranceCompany" defaultValue={s(c?.insuranceCompany)} />
          <Field label="Insurance rep" name="insuranceRep" defaultValue={s(c?.insuranceRep)} />
          <Field label="Policy number" name="policyNumber" defaultValue={s(c?.policyNumber)} />
          <Field label="Policy expiry" name="policyExpiry" type="date" defaultValue={c?.policyExpiry ? new Date(c.policyExpiry).toISOString().slice(0, 10) : ""} />
          <Field label="IATA number" name="iataNumber" defaultValue={s(c?.iataNumber)} />
          <div className="flex flex-wrap items-end gap-6 sm:col-span-2">
            <CheckField label="Copy insurance to rental" name="copyInsuranceToRental" defaultChecked={c?.copyInsuranceToRental} />
            <CheckField label="Undesired (do not rent)" name="isUndesired" defaultChecked={c?.isUndesired} />
            <CheckField label="Active" name="isActive" defaultChecked={c?.isActive ?? true} />
          </div>
        </FormDialog>
      )}
    </div>
  );
}

// ── Hours of operation ───────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Day = { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean };

export function HoursOfOperation() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const locations = (useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? []).filter((l) => l.isActive);
  const [locationId, setLocationId] = React.useState("");
  const loc = locationId || locations[0]?.id || "";
  const hours = useQuery({ ...trpc.staff.setup.hoursGet.queryOptions({ locationId: loc }), enabled: !!loc });
  const [days, setDays] = React.useState<Day[] | null>(null);
  const [saving, setSaving] = React.useState(false);
  const editable = can("LocationsEdit");
  const loaded = React.useMemo(
    () => DAYS.map((_, i) => {
      const h = hours.data?.find((x) => x.dayOfWeek === i);
      return { dayOfWeek: i, opensAt: h?.opensAt ?? "", closesAt: h?.closesAt ?? "", isClosed: h?.isClosed ?? false };
    }),
    [hours.data],
  );
  const rows = days ?? loaded;
  const set = (i: number, patch: Partial<Day>) => setDays(rows.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  async function save() {
    setSaving(true);
    try {
      await client.staff.setup.hoursSave.mutate({ locationId: loc, days: rows });
      toast.success("Hours saved");
      await hours.refetch();
      setDays(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-3 p-4 md:p-6">
      <NativeSelect className="w-full max-w-md" value={loc} onChange={(e) => { setLocationId(e.target.value); setDays(null); }} aria-label="Location">
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </NativeSelect>
      <Card className="max-w-2xl gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Opens</TableHead><TableHead>Closes</TableHead><TableHead>Closed</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((d, i) => (
              <TableRow key={d.dayOfWeek}>
                <TableCell className="font-medium">{DAYS[d.dayOfWeek]}</TableCell>
                <TableCell><Input type="time" className="w-32" value={d.opensAt} disabled={!editable || d.isClosed} onChange={(e) => set(i, { opensAt: e.target.value })} aria-label={`${DAYS[d.dayOfWeek]} opens`} /></TableCell>
                <TableCell><Input type="time" className="w-32" value={d.closesAt} disabled={!editable || d.isClosed} onChange={(e) => set(i, { closesAt: e.target.value })} aria-label={`${DAYS[d.dayOfWeek]} closes`} /></TableCell>
                <TableCell><Checkbox checked={d.isClosed} disabled={!editable} onChange={(e) => set(i, { isClosed: e.target.checked })} aria-label={`${DAYS[d.dayOfWeek]} closed`} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editable && <Button onClick={save} disabled={saving || !loc}><SaveIcon /> Save</Button>}
    </div>
  );
}

// ── Equipment ────────────────────────────────────────────────────────────────

export function EquipmentList() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.equipmentList.queryOptions());
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.equipmentList.queryKey() });
  const editable = can("Settings");
  type E = NonNullable<typeof data>[number];
  const dialog = (x?: E) => (
    <FormDialog
      title={x ? "Edit equipment" : "New equipment"}
      trigger={x ? editIcon(x.name) : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add New</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.equipmentSave.mutate({ id: x?.id, name: v.name as string, quantity: Number(v.quantity || 0), isActive: Boolean(v.isActive) });
        await refresh();
      }}
    >
      <Field label="Name" name="name" required defaultValue={x?.name} />
      <Field label="Quantity" name="quantity" type="number" min={0} defaultValue={s(x?.quantity ?? 0)} />
      <CheckField label="Active" name="isActive" defaultChecked={x?.isActive ?? true} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="max-w-2xl gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Equipment</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Active</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No equipment yet.</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell className="text-right tabular-nums">{x.quantity}</TableCell>
                <TableCell>{x.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  {editable && dialog(x)}
                  <DeleteButton label={x.name} disabled={!editable} onDelete={() => client.staff.setup.equipmentDelete.mutate({ id: x.id }).then(refresh)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
