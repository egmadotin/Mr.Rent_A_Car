"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv } from "../../../../_components/list-kit";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { SearchPicker } from "../../../../_components/search-picker";

const STATUS_LABEL: Record<string, string> = { OPEN: "Open", CLOSED: "Closed", PENDING: "Pending" };
const dateOnly = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const shortDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { timeZone: "UTC" }) : "");
const money = (v: unknown) => (v == null ? "" : Number(v).toFixed(2));

type Filters = {
  claimNumber?: string; internalClaimNumber?: string; renterName?: string; unit?: string; adjusterName?: string; adjusterPhone?: string; adjusterEmail?: string;
  vehicleLocationId?: string; statusOfRepair?: string; claimFrom?: string; claimTo?: string; closeFrom?: string; closeTo?: string;
};

/** Settings > Claims Management > Claims Management V2 (ClaimsMainV2.aspx): Claims list with Search options. */
export function ClaimsV2List() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const [quick, setQuick] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>({});
  const [adv, setAdv] = React.useState<Filters>({});
  const [del, setDel] = React.useState<{ id: string; number: number } | null>(null);
  const o = useQuery(trpc.staff.claimsV2.options.queryOptions()).data;
  const q = useQuery(trpc.staff.claimsV2.list.queryOptions(filters));
  const rows = q.data ?? [];
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAdv((a) => ({ ...a, [k]: e.target.value || undefined }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-end">
        {can("ClaimsAdd") ? (
          <Button asChild><Link href="/admin/settings/claims-v2/new"><PlusIcon /> New Claim</Link></Button>
        ) : (
          <Button disabled title={NO_PERMISSION}><PlusIcon /> New Claim</Button>
        )}
      </div>
      <LegacySearchBar placeholder="Claim Number" quick={quick} onQuickChange={setQuick} onSearch={(m) => setFilters(m === "quick" ? { claimNumber: quick.trim() || undefined } : adv)}>
        <SearchField label="Claim #" id="s-claim"><Input id="s-claim" onChange={set("claimNumber")} /></SearchField>
        <SearchField label="Internal Claim #" id="s-int"><Input id="s-int" onChange={set("internalClaimNumber")} /></SearchField>
        <SearchField label="Renter Name" id="s-renter"><Input id="s-renter" onChange={set("renterName")} /></SearchField>
        <SearchField label="Unit #" id="s-unit"><Input id="s-unit" onChange={set("unit")} /></SearchField>
        <SearchField label="Adjuster Name" id="s-adj"><Input id="s-adj" onChange={set("adjusterName")} /></SearchField>
        <SearchField label="Adjuster Phone" id="s-adjp"><Input id="s-adjp" onChange={set("adjusterPhone")} /></SearchField>
        <SearchField label="Adjuster Email" id="s-adje"><Input id="s-adje" onChange={set("adjusterEmail")} /></SearchField>
        <SearchField label="Vehicle Location." id="s-vloc">
          <NativeSelect id="s-vloc" onChange={set("vehicleLocationId")}><option value="" />{o?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
        </SearchField>
        <SearchField label="Claim Date From" id="s-cf"><Input id="s-cf" type="date" onChange={set("claimFrom")} /></SearchField>
        <SearchField label="To" id="s-ct"><Input id="s-ct" type="date" onChange={set("claimTo")} /></SearchField>
        <SearchField label="Claim Close Date From" id="s-xf"><Input id="s-xf" type="date" onChange={set("closeFrom")} /></SearchField>
        <SearchField label="To" id="s-xt"><Input id="s-xt" type="date" onChange={set("closeTo")} /></SearchField>
        <SearchField label="Status of Repair" id="s-sor">
          <NativeSelect id="s-sor" onChange={set("statusOfRepair")}><option value="" />{o?.repairStatuses.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
        </SearchField>
      </LegacySearchBar>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim # (Status)</TableHead><TableHead>Date Of Loss</TableHead><TableHead>Renter Name</TableHead><TableHead>Insurance Company</TableHead><TableHead>Claim Type</TableHead><TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={6} loading={q.isLoading} empty={!rows.length} emptyText="No Records Found" />
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/admin/settings/claims-v2/${r.id}`} className="font-medium text-primary hover:underline">{r.claimNumber || r.number}</Link>{" "}
                  <Badge variant={r.status === "OPEN" ? "info" : r.status === "PENDING" ? "pending" : "closed"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                </TableCell>
                <TableCell>{shortDate(r.dateOfLoss)}</TableCell>
                <TableCell>{r.renterName}</TableCell>
                <TableCell>{r.insuranceCompany}</TableCell>
                <TableCell>{r.claimType}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete claim ${r.number}`} disabled={!can("ClaimsDelete")} title={can("ClaimsDelete") ? undefined : NO_PERMISSION} onClick={() => setDel({ id: r.id, number: r.number })}><Trash2Icon className="text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListExportButtons onExport={() => exportCsv("claims.csv", ["Claim #", "Status", "Date Of Loss", "Renter Name", "Insurance Company", "Claim Type"], rows.map((r) => [r.claimNumber || r.number, STATUS_LABEL[r.status], shortDate(r.dateOfLoss), r.renterName, r.insuranceCompany, r.claimType]))} />
      <ConfirmAction
        open={!!del}
        onOpenChange={(x) => !x && setDel(null)}
        title={`Delete claim ${del?.number}?`}
        description="The claim and its details are removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await client.staff.claimsV2.delete.mutate({ id: del!.id });
            await qc.invalidateQueries({ queryKey: trpc.staff.claimsV2.list.queryKey() });
            toast.success("Claim deleted");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

/** Add Claim / Edit Claim (ClaimsV2Modify.aspx). */
export function ClaimV2Form({ id }: { id?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const router = useRouter();
  const can = useCan();
  const o = useQuery(trpc.staff.claimsV2.options.queryOptions()).data;
  const c = useQuery({ ...trpc.staff.claimsV2.get.queryOptions({ id: id ?? "" }), enabled: !!id });
  const [saving, setSaving] = React.useState(false);
  const [insurer, setInsurer] = React.useState<string | null>(null);
  const [shop, setShop] = React.useState<string | null>(null);
  const [vehicle, setVehicle] = React.useState<string | null>(null);
  const editable = can(id ? "ClaimsEdit" : "ClaimsAdd");
  const d = c.data;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "");
    setSaving(true);
    try {
      const r = await client.staff.claimsV2.save.mutate({
        id,
        data: {
          internalClaimNumber: s("internalClaimNumber"), claimNumber: s("claimNumber"), claimDate: s("claimDate"), status: s("status") as "OPEN", closeDate: s("closeDate"),
          repairLocationId: s("repairLocationId"), renterName: s("renterName"), vehicleId: vehicle ?? d?.vehicleId ?? "", rentalNumber: s("rentalNumber"), dateOfLoss: s("dateOfLoss"),
          claimType: s("claimType"), insuranceCompanyId: insurer ?? d?.insuranceCompanyId ?? "", stateOfIncident: s("stateOfIncident"), vehicleLocationId: shop ?? d?.vehicleLocationId ?? "",
          repairEstimate: s("repairEstimate"), statusOfRepair: s("statusOfRepair"), demandSent: fd.get("demandSent") === "on", deductibleAmount: s("deductibleAmount"),
          deductiblePaid: s("deductiblePaid"), lossOfUse: s("lossOfUse"), diminishedValue: s("diminishedValue"), adjusterName: s("adjusterName"), adjusterPhone: s("adjusterPhone"), adjusterEmail: s("adjusterEmail"),
        },
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.claimsV2.list.queryKey() });
      await qc.invalidateQueries({ queryKey: trpc.staff.claimsV2.get.queryKey() });
      toast.success(id ? "Claim saved" : `Claim ${r.number} added`);
      router.push("/admin/settings/claims-v2");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!o || (id && !d)) return <p className="p-6 text-sm text-muted-foreground">{c.error ? errorMessage(c.error) : "Loading…"}</p>;
  const companies = o.companies.map((x) => ({ id: x.id, label: x.name }));
  const regions = d?.stateOfIncident && !REGION_OPTIONS.includes(d.stateOfIncident) ? [d.stateOfIncident, ...REGION_OPTIONS] : REGION_OPTIONS;

  return (
    <form key={id ?? "new"} onSubmit={save} className="space-y-4 p-4 md:p-6">
      <fieldset disabled={!editable} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">{id ? `Claim ${d!.number}` : "Add Claim"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <F label="Internal Claim #" name="internalClaimNumber"><Input id="internalClaimNumber" name="internalClaimNumber" defaultValue={d?.internalClaimNumber ?? ""} /></F>
            <F label="Insurance Claim #" name="claimNumber"><Input id="claimNumber" name="claimNumber" defaultValue={d?.claimNumber ?? ""} /></F>
            <F label="Claim Date" name="claimDate"><Input id="claimDate" name="claimDate" type="date" defaultValue={dateOnly(d?.claimDate ?? (id ? null : new Date()))} /></F>
            <F label="Claim Status" name="status">
              <NativeSelect id="status" name="status" defaultValue={d?.status ?? "OPEN"}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="PENDING">Pending</option></NativeSelect>
            </F>
            <F label="Claim Close Date" name="closeDate"><Input id="closeDate" name="closeDate" type="date" defaultValue={dateOnly(d?.closeDate)} /></F>
            <F label="Repair Location" name="repairLocationId">
              <NativeSelect id="repairLocationId" name="repairLocationId" defaultValue={d?.repairLocationId ?? ""}><option value="" />{o.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect>
            </F>
            <F label="Renter Name" name="renterName"><Input id="renterName" name="renterName" defaultValue={d?.renterName ?? ""} /></F>
            <F label="Unit #" name="vehicleId">
              <SearchPicker id="vehicleId" items={o.vehicles} value={vehicle ?? d?.vehicleId ?? ""} onChange={setVehicle} placeholder="Type a unit #" />
            </F>
            <F label="Rental #" name="rentalNumber"><Input id="rentalNumber" name="rentalNumber" defaultValue={d?.rentalNumber ?? ""} /></F>
            <F label="Date Of Loss" name="dateOfLoss"><Input id="dateOfLoss" name="dateOfLoss" type="date" defaultValue={dateOnly(d?.dateOfLoss)} /></F>
            <F label="Claim Type" name="claimType" hint="Choices: Settings › Claim Types">
              <NativeSelect id="claimType" name="claimType" defaultValue={d?.claimType ?? ""}>
                <option value="" />
                {[...new Set([...(d?.claimType ? [d.claimType] : []), ...o.claimTypes])].map((t) => <option key={t}>{t}</option>)}
              </NativeSelect>
            </F>
            <F label="Insurance Company" name="insuranceCompanyId">
              <SearchPicker id="insuranceCompanyId" items={companies} value={insurer ?? d?.insuranceCompanyId ?? ""} onChange={setInsurer} placeholder="Type a company" />
            </F>
            <F label="State of Incident" name="stateOfIncident">
              <NativeSelect id="stateOfIncident" name="stateOfIncident" defaultValue={d?.stateOfIncident ?? ""}><option value="" />{regions.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
            </F>
            <F label="Vehicle Location." name="vehicleLocationId" hint="Where the vehicle is (body shop)">
              <SearchPicker id="vehicleLocationId" items={companies} value={shop ?? d?.vehicleLocationId ?? ""} onChange={setShop} placeholder="Type a company" />
            </F>
            <F label="Repair Estimate" name="repairEstimate"><Input id="repairEstimate" name="repairEstimate" inputMode="decimal" defaultValue={money(d?.repairEstimate)} /></F>
            <F label="Status of Repair" name="statusOfRepair" hint="Choices: Settings › Status of Repair">
              <NativeSelect id="statusOfRepair" name="statusOfRepair" defaultValue={d?.statusOfRepair ?? ""}>
                <option value="" />
                {[...new Set([...(d?.statusOfRepair ? [d.statusOfRepair] : []), ...o.repairStatuses])].map((t) => <option key={t}>{t}</option>)}
              </NativeSelect>
            </F>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="demandSent" defaultChecked={d?.demandSent ?? false} className="size-4" /> Demand Sent</label>
            <F label="Deductible Amount" name="deductibleAmount"><Input id="deductibleAmount" name="deductibleAmount" inputMode="decimal" defaultValue={money(d?.deductibleAmount)} /></F>
            <F label="Deductible Paid" name="deductiblePaid"><Input id="deductiblePaid" name="deductiblePaid" inputMode="decimal" defaultValue={money(d?.deductiblePaid)} /></F>
            <F label="Loss of Use" name="lossOfUse"><Input id="lossOfUse" name="lossOfUse" inputMode="decimal" defaultValue={money(d?.lossOfUse)} /></F>
            <F label="Diminished Value" name="diminishedValue"><Input id="diminishedValue" name="diminishedValue" inputMode="decimal" defaultValue={money(d?.diminishedValue)} /></F>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Adjuster</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <F label="Adjuster Name" name="adjusterName"><Input id="adjusterName" name="adjusterName" defaultValue={d?.adjusterName ?? ""} /></F>
            <F label="Adjuster Phone" name="adjusterPhone"><Input id="adjusterPhone" name="adjusterPhone" type="tel" defaultValue={d?.adjusterPhone ?? ""} /></F>
            <F label="Adjuster Email" name="adjusterEmail"><Input id="adjusterEmail" name="adjusterEmail" type="email" defaultValue={d?.adjusterEmail ?? ""} /></F>
          </CardContent>
        </Card>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild><Link href="/admin/settings/claims-v2">Cancel</Link></Button>
        <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
