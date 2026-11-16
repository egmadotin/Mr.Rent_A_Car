"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { cn } from "@mrac/ui/lib/utils";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { ListExportButtons, exportCsv, legacyDate } from "../../../../_components/list-kit";

type Draft = { id?: string; locationId: string; rateId: string; vehicleTypeIds: string[]; startsAt: string; endsAt: string; discountType: "" | "PERCENT" | "AMOUNT"; value: string; applyOnMileage: boolean };
const toInput = (d: Date | string) => {
  const x = new Date(d);
  return new Date(+x - x.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Rate*, Vehicle Type (ticks + All), Begin / End Date*, DiscountType*, Discount Amount*, Pay Now Discount on Mileage. */
function DiscountForm({ draft, setDraft, onDone }: { draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft | null>>; onDone: () => void }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const rates = useQuery({ ...trpc.staff.settings.rateList.queryOptions({ locationId: draft.locationId, active: true }), enabled: !!draft.locationId }).data ?? [];
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const types = lookups?.vehicleTypes ?? [];
  const all = draft.vehicleTypeIds.length === 0;

  async function save() {
    setBusy(true);
    try {
      await client.staff.payNow.save.mutate({
        id: draft.id,
        data: { ...draft, startsAt: new Date(draft.startsAt), endsAt: new Date(draft.endsAt), discountType: draft.discountType as "PERCENT", value: Number(draft.value) },
      });
      toast.success("Pay now discount saved");
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <p className="text-sm font-semibold">{draft.id ? "Edit" : "Add"} Pay Now Discount</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <F label="Location *">
            <NativeSelect value={draft.locationId} onChange={(e) => setDraft((d) => (d ? { ...d, locationId: e.target.value, rateId: "" } : d))}>
              {lookups?.locations.filter((l) => l.isActive).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </NativeSelect>
          </F>
          <F label="Rate *">
            <NativeSelect value={draft.rateId} onChange={(e) => set("rateId", e.target.value)}>
              <option value="" />
              {rates.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </NativeSelect>
          </F>
          <F label="Begin Date *"><Input type="datetime-local" value={draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></F>
          <F label="End Date *"><Input type="datetime-local" value={draft.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></F>
          <F label="Vehicle Type" className="md:row-span-2">
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2 text-sm">
              <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="accent-primary" checked={all} onChange={() => set("vehicleTypeIds", [])} /> All</label>
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={!all && draft.vehicleTypeIds.includes(t.id)}
                    onChange={(e) => set("vehicleTypeIds", e.target.checked ? [...draft.vehicleTypeIds, t.id] : draft.vehicleTypeIds.filter((x) => x !== t.id))}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </F>
          <F label="DiscountType *">
            <NativeSelect value={draft.discountType} onChange={(e) => set("discountType", e.target.value as Draft["discountType"])}>
              <option value="">Please Select</option>
              <option value="AMOUNT">$</option>
              <option value="PERCENT">%</option>
            </NativeSelect>
          </F>
          <F label="Discount Amount *"><Input type="number" min={0} step="0.01" value={draft.value} onChange={(e) => set("value", e.target.value)} /></F>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={draft.applyOnMileage} onChange={(e) => set("applyOnMileage", e.target.checked)} /> Pay Now Discount on Mileage
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          <Button type="button" disabled={busy || !draft.rateId || !draft.startsAt || !draft.endsAt || !draft.discountType || !draft.value} onClick={save}>
            {busy && <Loader2Icon className="animate-spin" />}Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Settings > Rates > Pay Now Discounts: Search Options, the list (Description · Location · Begin / End · Type · Rate · Vehicle Type(s) · Delete), New / Edit. */
export function PayNowDiscounts() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const editable = can("RatesEdit");
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [showSearch, setShowSearch] = React.useState(false);
  const [q, setQ] = React.useState({ search: "", locationId: "", vehicleTypeId: "", discountType: "", from: "", to: "" });
  const [run, setRun] = React.useState(q);
  const list = useQuery(
    trpc.staff.payNow.list.queryOptions({
      search: run.search || undefined,
      locationIds: run.locationId ? [run.locationId] : undefined,
      vehicleTypeIds: run.vehicleTypeId ? [run.vehicleTypeId] : undefined,
      discountType: (run.discountType || undefined) as "PERCENT" | undefined,
      from: run.from ? new Date(run.from) : undefined,
      to: run.to ? new Date(`${run.to}T23:59`) : undefined,
    }),
  );
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const set = (k: keyof typeof q) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setQ((x) => ({ ...x, [k]: e.target.value }));

  function startNew() {
    const loc = lookups?.locations.find((l) => l.isActive)?.id ?? "";
    setDraft({ locationId: loc, rateId: "", vehicleTypeIds: [], startsAt: "", endsAt: "", discountType: "", value: "", applyOnMileage: false });
  }
  async function edit(id: string) {
    try {
      const r = await client.staff.payNow.get.query({ id });
      setDraft({ id, locationId: r.locationId, rateId: r.rateId ?? "", vehicleTypeIds: r.vehicleTypeIds, startsAt: toInput(r.startsAt), endsAt: toInput(r.endsAt), discountType: r.discountType, value: r.value, applyOnMileage: r.applyOnMileage });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function remove(id: string) {
    try {
      await client.staff.payNow.remove.mutate({ id });
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const rateText = (r: { discountType: string; value: string }) => (r.discountType === "PERCENT" ? `${Number(r.value)}%` : `$${r.value}`);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => setShowSearch((x) => !x)} aria-expanded={showSearch}>
          Search Options <ChevronDownIcon className={cn("transition-transform", showSearch && "rotate-180")} />
        </Button>
        <Input className="max-w-sm" placeholder="Rate Description" value={q.search} onChange={set("search")} onKeyDown={(e) => e.key === "Enter" && setRun(q)} aria-label="Rate Description" />
        <Button type="button" onClick={() => setRun(q)}>Search</Button>
        {editable ? (
          <Button type="button" className="ml-auto" onClick={startNew}><PlusIcon /> New Pay Now Discount</Button>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">{NO_PERMISSION}</span>
        )}
      </div>
      {showSearch && (
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <F label="Location">
              <NativeSelect value={q.locationId} onChange={set("locationId")}>
                <option value="">All</option>
                {lookups?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </F>
            <F label="Vehicle Type">
              <NativeSelect value={q.vehicleTypeId} onChange={set("vehicleTypeId")}>
                <option value="">All</option>
                {lookups?.vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </F>
            <F label="Discount Type">
              <NativeSelect value={q.discountType} onChange={set("discountType")}>
                <option value="">All</option>
                <option value="AMOUNT">$</option>
                <option value="PERCENT">%</option>
              </NativeSelect>
            </F>
            <F label="Begin Date"><Input type="date" value={q.from} onChange={set("from")} /></F>
            <F label="End Date"><Input type="date" value={q.to} onChange={set("to")} /></F>
          </CardContent>
        </Card>
      )}
      {draft && <DiscountForm draft={draft} setDraft={setDraft} onDone={() => { setDraft(null); void list.refetch(); }} />}
      <Card className="gap-0 py-0">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {["Description", "Location", "Begin Date", "End Date", "Discount Type", "Discount Rate", "Vehicle Type(s)"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
                <th className="w-16 px-2 py-2 font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              {!list.data?.length && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">{list.isLoading ? "Loading…" : "No Records Found"}</td></tr>}
              {list.data?.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="px-4 py-2">
                    {editable ? <button type="button" className="font-medium text-primary hover:underline" onClick={() => void edit(r.id)}>{r.description}</button> : r.description}
                    {r.applyOnMileage && <span className="ml-1.5 text-xs text-muted-foreground">(+ mileage)</span>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.location}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{legacyDate(r.startsAt)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{legacyDate(r.endsAt)}</td>
                  <td className="px-4 py-2">{r.discountType === "PERCENT" ? "%" : "$"}</td>
                  <td className="px-4 py-2 tabular-nums">{rateText(r)}</td>
                  <td className="max-w-64 truncate px-4 py-2" title={r.vehicleTypes}>{r.vehicleTypes}</td>
                  <td className="px-2">
                    {editable && <Button type="button" variant="ghost" size="icon" aria-label="Delete" onClick={() => void remove(r.id)}><Trash2Icon className="size-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ListExportButtons
        onExport={() =>
          exportCsv("Pay Now Discounts.csv", ["Description", "Location", "Begin Date", "End Date", "Discount Type", "Discount Rate", "Vehicle Type(s)", "On Mileage"], (list.data ?? []).map((r) => [r.description, r.location, legacyDate(r.startsAt), legacyDate(r.endsAt), r.discountType === "PERCENT" ? "%" : "$", rateText(r), r.vehicleTypes, r.applyOnMileage ? "Yes" : "No"]))
        }
      />
    </div>
  );
}

const PARTNER_FIELDS = [
  ["askForCreditCard", "Ask For Credit Card"],
  ["askForDriverLicense", "Ask For Driver License"],
  ["askForFullAddress", "Ask For Full Address"],
  ["askForBirthDate", "Ask For Birth Date"],
  ["askForFlightInfo", "Ask For Flight Info"],
  ["askForEmploymentInfo", "Ask For Employment Info"],
  ["askForCompanyInfo", "Ask For Company Info"],
  ["askForInsuranceInfo", "Ask For Insurance Info"],
  ["askForSsn", "Ask For SSN"],
  ["showDeliveryAddress", "Show Delivery Address"],
] as const;
type PartnerKey = (typeof PARTNER_FIELDS)[number][0];

/** Settings > Company > Partner Login Setup (PartnerLoginSetup.aspx): the ten ticks, Cancel / Save. */
export function PartnerLoginSetup() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const editable = can("Settings");
  const q = useQuery(trpc.staff.payNow.partnerGet.queryOptions());
  const blank = Object.fromEntries(PARTNER_FIELDS.map(([k]) => [k, false])) as Record<PartnerKey, boolean>;
  const [v, setV] = React.useState<Record<PartnerKey, boolean> | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (q.isSuccess && !v) setV(q.data ? (Object.fromEntries(PARTNER_FIELDS.map(([k]) => [k, q.data![k]])) as Record<PartnerKey, boolean>) : blank);
  }, [q.isSuccess, q.data, v, blank]);
  if (!v) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  async function save() {
    setBusy(true);
    try {
      await client.staff.payNow.partnerSave.mutate(v!);
      toast.success("Partner login setup saved");
      await q.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-xl">
        <CardContent className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PARTNER_FIELDS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" disabled={!editable} checked={v[k]} onChange={(e) => setV((x) => (x ? { ...x, [k]: e.target.checked } : x))} />
                {label}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            {!editable && <span className="mr-auto text-xs text-muted-foreground">{NO_PERMISSION}</span>}
            <Button type="button" variant="outline" disabled={busy} onClick={() => setV(null)}>Cancel</Button>
            <Button type="button" disabled={!editable || busy} onClick={save}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
