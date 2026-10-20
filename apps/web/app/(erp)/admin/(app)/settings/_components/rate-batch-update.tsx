"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Master Rate Batch Update (BaseRateUpdate.aspx): Find Rate (Location, Rate Code, Season) → the rate's values per
 * vehicle type; Adjust Rate (up to six: value, By, Percent % / Flat / Total) → "Update Grid", check, then Save.
 */

const FIELDS = [
  ["hourly", "Hourly"], ["daily", "Daily"], ["extraDaily", "Extra Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"],
  ["kmAllowed", "KM Allowed Daily"], ["kmWeekly", "KM Allowed Weekly"], ["kmMonthly", "KM Allowed Monthly"],
] as const;
type Field = (typeof FIELDS)[number][0];
type Row = { id: string; vehicleType: string } & Record<Field, number | null>;
const isKm = (f: Field) => f.startsWith("km");

export function RateBatchUpdate() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const [locationId, setLocationId] = React.useState("");
  const rates = useQuery({ ...trpc.staff.settings.rateList.queryOptions({ locationId, active: true }), enabled: !!locationId }).data ?? [];
  const [rateId, setRateId] = React.useState("");
  const [seasonId, setSeasonId] = React.useState("");
  const [search, setSearch] = React.useState<{ rateId: string; seasonId: string | null } | null>(null);
  const grid = useQuery({ ...trpc.staff.settings.rateBatchGrid.queryOptions(search ?? { rateId: "", seasonId: null }), enabled: !!search });
  const seasonsFor = useQuery({ ...trpc.staff.settings.rateBatchGrid.queryOptions({ rateId, seasonId: null }), enabled: !!rateId }).data?.seasons ?? [];
  const [rows, setRows] = React.useState<Row[]>([]);
  const [adjust, setAdjust] = React.useState(() => Array.from({ length: 6 }, () => ({ field: "" as Field | "", by: "", type: "PERCENT" })));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setRows((grid.data?.rows ?? []) as Row[]), [grid.data]);
  const editable = can("RatesEdit");

  function updateGrid() {
    const ops = adjust.filter((a) => a.field && a.by !== "" && !Number.isNaN(Number(a.by)));
    if (!ops.length) return toast.error("Choose a value to adjust and an amount.");
    setRows((rs) =>
      rs.map((r) => {
        const next = { ...r };
        for (const a of ops) {
          const f = a.field as Field;
          const by = Number(a.by);
          const cur = next[f];
          let v: number | null = cur;
          if (a.type === "TOTAL") v = by;
          else if (cur != null) v = a.type === "PERCENT" ? cur * (1 + by / 100) : cur + by;
          if (v != null) v = isKm(f) ? Math.max(0, Math.round(v)) : Math.max(0, Math.round(v * 100) / 100);
          next[f] = v;
        }
        return next;
      }),
    );
    toast.success("Grid updated — check the values, then Save.");
  }

  async function save() {
    if (!search) return;
    setSaving(true);
    try {
      const r = await client.staff.settings.rateBatchSave.mutate({ rateId: search.rateId, rows: rows.map(({ vehicleType: _v, ...x }) => x) });
      await qc.invalidateQueries({ queryKey: trpc.staff.settings.pathKey() });
      toast.success(`Saved ${r.saved} vehicle type(s)`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Find Rate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rb-loc">Location</Label>
              <NativeSelect id="rb-loc" value={locationId} onChange={(e) => { setLocationId(e.target.value); setRateId(""); setSeasonId(""); }}>
                <option value="" />
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-rate">Rate Code</Label>
              <NativeSelect id="rb-rate" value={rateId} onChange={(e) => { setRateId(e.target.value); setSeasonId(""); }} disabled={!locationId}>
                <option value="" />
                {rates.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rb-season">Season</Label>
              <NativeSelect id="rb-season" value={seasonId} onChange={(e) => setSeasonId(e.target.value)} disabled={!rateId}>
                <option value="">{seasonsFor.length ? "No season (date range)" : ""}</option>
                {seasonsFor.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </NativeSelect>
            </div>
            <Button className="w-full" disabled={!rateId} onClick={() => setSearch({ rateId, seasonId: seasonId || null })}>Search</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Adjust Rate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {adjust.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem_8rem] gap-2">
                <NativeSelect aria-label={`Adjust ${i + 1}`} value={a.field} onChange={(e) => setAdjust((x) => x.map((y, j) => (j === i ? { ...y, field: e.target.value as Field } : y)))}>
                  <option value="" />
                  {FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </NativeSelect>
                <Input aria-label={`By ${i + 1}`} type="number" step="any" value={a.by} onChange={(e) => setAdjust((x) => x.map((y, j) => (j === i ? { ...y, by: e.target.value } : y)))} />
                <NativeSelect aria-label={`Type ${i + 1}`} value={a.type} onChange={(e) => setAdjust((x) => x.map((y, j) => (j === i ? { ...y, type: e.target.value } : y)))}>
                  <option value="PERCENT">Percent %</option>
                  <option value="FLAT">Flat</option>
                  <option value="TOTAL">Total</option>
                </NativeSelect>
              </div>
            ))}
            <Button className="w-full" onClick={updateGrid} disabled={!rows.length}>Update Grid</Button>
          </CardContent>
        </Card>
      </div>

      {search && (
        <Card className="gap-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="px-2 py-2 text-left font-medium">Vehicle Type</th>{FIELDS.map(([k, l]) => <th key={k} className="px-2 py-2 text-right font-medium">{l}</th>)}</tr>
              </thead>
              <tbody>
                {grid.isLoading && <tr><td colSpan={9} className="p-3 text-muted-foreground">Loading…</td></tr>}
                {!grid.isLoading && rows.length === 0 && <tr><td colSpan={9} className="p-3 text-muted-foreground">No rates for this rate code and season.</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1 font-medium">{r.vehicleType}</td>
                    {FIELDS.map(([k, l]) => (
                      <td key={k} className="px-1 py-1">
                        <Input
                          aria-label={`${r.vehicleType} ${l}`}
                          type="number"
                          min={0}
                          step={isKm(k) ? 1 : 0.01}
                          className="h-8 w-24 text-right"
                          value={r[k] ?? ""}
                          onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, [k]: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => grid.refetch()} disabled={!search}>Cancel</Button>
        <Button onClick={save} disabled={!rows.length || saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
