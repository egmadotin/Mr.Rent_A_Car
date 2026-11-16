"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { cn } from "@mrac/ui/lib/utils";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Settings > Rates > Rate Sets (client request, Nov 17): a season's rates as one grid — vehicle class × rental-length
 * band (1–2, 3–5 … 26–30 days) — instead of opening each of the seven rate codes. Plus "New rate set" for a new season.
 */

const FIELDS = [
  ["daily", "Daily"], ["hourly", "Hourly"], ["extraDaily", "Extra daily"], ["weekly", "Weekly"], ["monthly", "Monthly"],
  ["kmAllowed", "KM daily"], ["kmWeekly", "KM weekly"], ["kmMonthly", "KM monthly"],
] as const;
type Field = (typeof FIELDS)[number][0];
const DEFAULT_BANDS = "1-2, 3-5, 6-10, 11-15, 16-20, 21-25, 26-30";

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function RateSets({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [locationId, setLocationId] = React.useState(defaultLocationId ?? "");
  React.useEffect(() => {
    if (!locationId && lookups?.locations[0]) setLocationId(lookups.locations.find((l) => l.isActive)?.id ?? lookups.locations[0].id);
  }, [lookups, locationId]);
  const sets = useQuery({ ...trpc.staff.rateSets.list.queryOptions({ locationId }), enabled: !!locationId });
  const [setName, setSetName] = React.useState("");
  const current = sets.data?.find((s) => s.name === setName) ?? sets.data?.[0];
  const [seasonId, setSeasonId] = React.useState<string>("");
  const season = current?.seasons.find((s) => s.id === seasonId) ?? current?.seasons[0];
  React.useEffect(() => {
    if (current && !current.seasons.some((s) => s.id === seasonId)) setSeasonId(current.seasons[0]?.id ?? "");
  }, [current, seasonId]);
  const [field, setField] = React.useState<Field>("daily");
  const [onlyPriced, setOnlyPriced] = React.useState(true);
  const grid = useQuery({
    ...trpc.staff.rateSets.grid.queryOptions({ locationId, set: current?.name ?? "", seasonId: season?.id ?? null }),
    enabled: !!current,
  });
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  React.useEffect(() => setEdits({}), [locationId, current?.name, season?.id, field]);

  const cell = (rateId: string, typeId: string) => grid.data?.cells.find((c) => c.rateId === rateId && c.vehicleTypeId === typeId);
  const valueOf = (rateId: string, typeId: string) => {
    const k = `${rateId}|${typeId}`;
    if (k in edits) return edits[k]!;
    const v = cell(rateId, typeId)?.[field];
    return v == null ? "" : String(v);
  };
  const priced = (typeId: string) => grid.data?.cells.some((c) => c.vehicleTypeId === typeId && (c.daily != null || c.hourly != null)) ?? false;
  const types = (grid.data?.types ?? []).filter((t) => !onlyPriced || priced(t.id) || Object.keys(edits).some((k) => k.endsWith(`|${t.id}`)));
  const dirty = Object.keys(edits).length;

  async function save() {
    setBusy(true);
    try {
      const cells = Object.entries(edits).map(([k, v]) => {
        const [rateId, vehicleTypeId] = k.split("|") as [string, string];
        return { rateId, vehicleTypeId, value: v.trim() === "" ? null : Number(v) };
      });
      if (cells.some((c) => c.value != null && !Number.isFinite(c.value))) throw new Error("Numbers only.");
      const r = await client.staff.rateSets.save.mutate({ seasonId: season?.id ?? null, field, cells });
      toast.success(`${r.saved} price${r.saved === 1 ? "" : "s"} saved`);
      setEdits({});
      await grid.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <F label="Location" className="w-64">
          <NativeSelect value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {lookups?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </F>
        <F label="Rate set" className="w-60">
          <NativeSelect value={current?.name ?? ""} onChange={(e) => setSetName(e.target.value)} disabled={!sets.data?.length}>
            {sets.data?.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.bands.length} codes){s.active ? "" : " — inactive"}</option>)}
          </NativeSelect>
        </F>
        <F label="Season" className="w-48">
          <NativeSelect value={season?.id ?? ""} onChange={(e) => setSeasonId(e.target.value)} disabled={!current?.seasons.length}>
            {current?.seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </F>
        <div className="ml-auto flex gap-2">
          {can("RatesAdd") ? (
            <Button type="button" variant="outline" onClick={() => setCreating(true)}><PlusIcon /> New rate set</Button>
          ) : null}
        </div>
      </div>

      {sets.data && sets.data.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No rate sets at this location yet. A set is rate codes named like &ldquo;INT Fall End 1 to 2 Days&rdquo;, &ldquo;… 3 to 5 Days&rdquo; — create one with New rate set.
        </p>
      )}

      {current && (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap rounded-md border p-0.5" role="tablist" aria-label="Price">
                {FIELDS.map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={field === k} onClick={() => setField(k)}
                    className={cn("rounded px-3 py-1 text-sm font-medium", field === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {l}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={onlyPriced} onChange={(e) => setOnlyPriced(e.target.checked)} /> Only priced classes
              </label>
              <span className="ml-auto text-xs text-muted-foreground">Blank = that class isn&apos;t offered for that length</span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">Vehicle class</th>
                    {grid.data?.bands.map((b) => (
                      <th key={b.rateId} className="px-2 py-2 text-right font-medium" title={b.code}>
                        <span className="block text-sm font-semibold text-foreground">{b.from}–{b.to} days</span>
                        {!b.isActive && <span className="text-destructive">inactive</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.isLoading && <tr><td className="px-3 py-6 text-muted-foreground" colSpan={9}>Loading…</td></tr>}
                  {types.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="sticky left-0 bg-card px-3 py-1.5 font-medium whitespace-nowrap">{t.name}</td>
                      {grid.data?.bands.map((b) => {
                        const k = `${b.rateId}|${t.id}`;
                        return (
                          <td key={b.rateId} className="px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              step={field.startsWith("km") ? 1 : 0.01}
                              aria-label={`${t.name} ${b.from}–${b.to} days ${field}`}
                              disabled={!can("RatesEdit")}
                              className={cn(
                                "h-8 w-full min-w-20 rounded-md border bg-transparent px-2 text-right tabular-nums focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                                k in edits && "border-primary bg-primary/5",
                              )}
                              value={valueOf(b.rateId, t.id)}
                              onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {grid.data && types.length === 0 && <tr><td className="px-3 py-6 text-muted-foreground" colSpan={9}>No priced classes in this season — untick &ldquo;Only priced classes&rdquo; to add prices.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              {!can("RatesEdit") && <span className="text-xs text-muted-foreground">{NO_PERMISSION}</span>}
              {dirty > 0 && <span className="text-sm text-muted-foreground">{dirty} change{dirty === 1 ? "" : "s"}</span>}
              {dirty > 0 && <Button type="button" variant="outline" onClick={() => setEdits({})}>Discard</Button>}
              <Button type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {creating && (
        <NewRateSet
          locationId={locationId}
          locations={lookups?.locations ?? []}
          seasons={lookups?.seasons ?? []}
          sameLocationSets={sets.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={async (name) => {
            setCreating(false);
            await sets.refetch();
            setSetName(name);
          }}
        />
      )}
    </div>
  );
}

function NewRateSet({
  locationId,
  locations,
  seasons,
  sameLocationSets,
  onClose,
  onCreated,
}: {
  locationId: string;
  locations: { id: string; name: string }[];
  seasons: { id: string; name: string }[];
  sameLocationSets: { name: string; seasons: { id: string; name: string }[] }[];
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const [name, setName] = React.useState("");
  const [seasonIds, setSeasonIds] = React.useState<string[]>([]);
  const [bands, setBands] = React.useState(DEFAULT_BANDS);
  const [copyLoc, setCopyLoc] = React.useState(locationId);
  const copySets = useQuery({ ...trpc.staff.rateSets.list.queryOptions({ locationId: copyLoc }), enabled: !!copyLoc }).data ?? (copyLoc === locationId ? sameLocationSets : []);
  const [copySet, setCopySet] = React.useState("");
  const src = copySets.find((s) => s.name === copySet);
  const [copySeason, setCopySeason] = React.useState("");
  const [percent, setPercent] = React.useState("0");
  const [online, setOnline] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [seasonQ, setSeasonQ] = React.useState("");

  const parsed = bands.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split("-").map((n) => Number(n.trim())) as [number, number]);
  const bandsOk = parsed.length > 0 && parsed.every((b) => b.length === 2 && b.every(Number.isInteger) && b[1] >= b[0]);

  async function create() {
    setBusy(true);
    try {
      const r = await client.staff.rateSets.create.mutate({
        locationId,
        name: name.trim(),
        seasonIds,
        bands: parsed,
        displayOnline: online,
        copyFrom: src ? { locationId: copyLoc, set: src.name, seasonId: copySeason || src.seasons[0]?.id || null, percent: Number(percent) || 0 } : null,
      });
      toast.success(`${r.created} rate codes created`);
      onCreated(name.trim());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New rate set</DialogTitle>
          <DialogDescription>Creates one rate code per rental length at this location (e.g. &ldquo;INT Winter 1 to 2 Days&rdquo; … &ldquo;26 to 30 Days&rdquo;), valid in the chosen seasons.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Set name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. INT Winter" /></F>
          <F label="Rental lengths (days)"><Input value={bands} onChange={(e) => setBands(e.target.value)} className={cn(!bandsOk && "border-destructive")} /></F>
          <F label={`Seasons * (${seasonIds.length} chosen)`} className="sm:col-span-2">
            <Input placeholder="Find a season" value={seasonQ} onChange={(e) => setSeasonQ(e.target.value)} />
            <div className="mt-1.5 grid max-h-36 grid-cols-2 gap-x-4 overflow-y-auto rounded-md border p-2 text-sm sm:grid-cols-3">
              {seasons.filter((s) => s.name.toLowerCase().includes(seasonQ.toLowerCase())).map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" className="accent-primary" checked={seasonIds.includes(s.id)} onChange={(e) => setSeasonIds((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} />
                  <span className="truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </F>
          <div className="space-y-3 rounded-md border p-3 sm:col-span-2">
            <p className="text-sm font-medium">Copy prices from (optional)</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <F label="Location">
                <NativeSelect value={copyLoc} onChange={(e) => { setCopyLoc(e.target.value); setCopySet(""); }}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </NativeSelect>
              </F>
              <F label="Set">
                <NativeSelect value={copySet} onChange={(e) => { setCopySet(e.target.value); setCopySeason(""); }}>
                  <option value="">Don&apos;t copy</option>
                  {copySets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </NativeSelect>
              </F>
              <F label="Season">
                <NativeSelect value={copySeason || src?.seasons[0]?.id || ""} onChange={(e) => setCopySeason(e.target.value)} disabled={!src}>
                  {src?.seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              </F>
              <F label="Change prices by (%)"><Input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} disabled={!src} /></F>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="accent-primary" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Offer online (Display online)
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy || name.trim().length < 2 || !seasonIds.length || !bandsOk} onClick={() => void create()}>
            {busy && <Loader2Icon className="animate-spin" />}Create {bandsOk ? parsed.length : ""} codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
