"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { cn } from "@mrac/ui/lib/utils";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Settings > Rates: Rate Blocking, Rate Values Update, Rate Utilization, Overbooking Control and Rates Calendar, each as
 * RentCentric lays them out (Find / scope on the left, the change on the right, Save), with the saved entries listed below.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIERS = Array.from({ length: 16 }, (_, i) => i * 10);
const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);
const asDates = <T extends { startDate: string; endDate: string }>(s: T) => ({ ...s, startDate: new Date(s.startDate), endDate: new Date(s.endDate) });

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Location (required), Rate Code and Vehicle Type ("All" = blank), From / To. */
function useScope(opts: { rate?: boolean; type?: boolean } = { rate: true, type: true }) {
  const trpc = useTRPC();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [s, setS] = React.useState({ locationId: "", rateId: "", vehicleTypeId: "", startDate: today(), endDate: today() });
  const rates = useQuery({ ...trpc.staff.settings.rateList.queryOptions({ locationId: s.locationId, active: true }), enabled: !!s.locationId && opts.rate !== false }).data ?? [];
  const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS((x) => ({ ...x, [k]: e.target.value, ...(k === "locationId" ? { rateId: "" } : {}) }));
  const fields = (
    <>
      <Field label="Location *">
        <NativeSelect value={s.locationId} onChange={set("locationId")}>
          <option value="">Select</option>
          {lookups?.locations.filter((l) => l.isActive).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
      </Field>
      {opts.rate !== false && (
        <Field label="Rate Code">
          <NativeSelect value={s.rateId} onChange={set("rateId")} disabled={!s.locationId}>
            <option value="">All rates</option>
            {rates.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
          </NativeSelect>
        </Field>
      )}
      {opts.type !== false && (
        <Field label="Vehicle Type">
          <NativeSelect value={s.vehicleTypeId} onChange={set("vehicleTypeId")}>
            <option value="">All vehicle types</option>
            {lookups?.vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From *"><Input type="date" value={s.startDate} onChange={set("startDate")} /></Field>
        <Field label="To *"><Input type="date" value={s.endDate} onChange={set("endDate")} /></Field>
      </div>
    </>
  );
  return { s, setS, fields, lookups };
}

function Weekdays({ value, onChange }: { value: boolean[]; onChange: (v: boolean[]) => void }) {
  const all = value.every(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange(Array(7).fill(!all))} className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", all && "border-primary/60 bg-primary/10 text-primary")}>All</button>
      {WEEKDAYS.map((d, i) => (
        <button key={d} type="button" aria-pressed={value[i]} onClick={() => onChange(value.map((x, k) => (k === i ? !x : x)))}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", value[i] ? "border-primary/60 bg-primary/10 text-primary" : "text-muted-foreground")}>
          {d}
        </button>
      ))}
    </div>
  );
}

function SaveBar({ busy, disabled, onSave, label = "Save" }: { busy: boolean; disabled?: boolean; onSave: () => void; label?: string }) {
  const can = useCan();
  const ok = can("RatesEdit");
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-4">
      {!ok && <span className="text-xs text-muted-foreground">{NO_PERMISSION}</span>}
      <Button type="button" disabled={!ok || busy || disabled} onClick={onSave}>
        {busy && <Loader2Icon className="animate-spin" />}
        {label}
      </Button>
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => Promise<unknown> }) {
  const can = useCan();
  const [busy, setBusy] = React.useState(false);
  if (!can("RatesEdit")) return null;
  return (
    <Button type="button" variant="ghost" size="icon" aria-label="Remove" disabled={busy}
      onClick={async () => { setBusy(true); try { await onRemove(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } }}>
      {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon className="size-4" />}
    </Button>
  );
}

function List({ title, empty, head, children }: { title: string; empty: boolean; head: string[]; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>{head.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}<th className="w-12" /></tr>
          </thead>
          <tbody>
            {empty ? <tr><td colSpan={head.length + 1} className="px-4 py-6 text-center text-muted-foreground">None yet.</td></tr> : children}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

const daysText = (w: boolean[]) => (w.every(Boolean) ? "Every day" : WEEKDAYS.filter((_, i) => w[i]).join(", "));

/** Rate Blocking (BLOCK) or Rate Values Update (ADJUST). */
export function RateRules({ kind }: { kind: "BLOCK" | "ADJUST" }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const list = useQuery(trpc.staff.rateControls.rules.queryOptions({ kind }));
  const { s, fields } = useScope();
  const [weekdays, setWeekdays] = React.useState<boolean[]>(Array(7).fill(true));
  const [changeType, setChangeType] = React.useState<"PERCENT" | "FLAT" | "TOTAL">("PERCENT");
  const [value, setValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      await client.staff.rateControls.addRule.mutate({ kind, ...asDates(s), weekdays, changeType: kind === "ADJUST" ? changeType : null, value: kind === "ADJUST" ? Number(value) : null, note });
      toast.success(kind === "BLOCK" ? "Rate blocked" : "Rate adjustment saved");
      setValue("");
      setNote("");
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const change = (r: { changeType: string | null; value: string | null }) =>
    r.value == null ? "" : r.changeType === "PERCENT" ? `${Number(r.value) > 0 ? "+" : ""}${r.value}%` : r.changeType === "FLAT" ? `${Number(r.value) > 0 ? "+" : ""}$${r.value} / day` : `$${r.value} / day`;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Find Rate</p>
              {fields}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">{kind === "BLOCK" ? "Block Rate" : "Adjust Rate"}</p>
              <Field label="On these pickup days"><Weekdays value={weekdays} onChange={setWeekdays} /></Field>
              {kind === "ADJUST" && (
                <div className="grid grid-cols-[1fr_10rem] gap-3">
                  <Field label="Change daily rate by *"><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 10 or -5" /></Field>
                  <Field label="As">
                    <NativeSelect value={changeType} onChange={(e) => setChangeType(e.target.value as typeof changeType)}>
                      <option value="PERCENT">Percent %</option>
                      <option value="FLAT">Flat $ (+/-)</option>
                      <option value="TOTAL">Total $ (set to)</option>
                    </NativeSelect>
                  </Field>
                </div>
              )}
              <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. long weekend" /></Field>
              <p className="text-xs text-muted-foreground">
                {kind === "BLOCK"
                  ? "A blocked rate isn't offered (staff Rate list and online) for pickups on these days. Remove the entry to unblock."
                  : "Each day of a rental that falls on these dates and weekdays is priced at the changed daily rate. The newest entry wins when two overlap."}
              </p>
            </div>
          </div>
          <SaveBar busy={busy} disabled={!s.locationId || (kind === "ADJUST" && value === "")} onSave={save} />
        </CardContent>
      </Card>
      <List title={kind === "BLOCK" ? "Blocked rates" : "Rate adjustments"} empty={!list.data?.length} head={["Location", "Rate", "Vehicle type", "Dates", "Days", ...(kind === "ADJUST" ? ["Change"] : []), "Note"]}>
        {list.data?.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-4 py-2">{r.location}</td>
            <td className="px-4 py-2">{r.rate}</td>
            <td className="px-4 py-2">{r.vehicleType}</td>
            <td className="px-4 py-2 whitespace-nowrap">{fmtDay(r.startDate)} – {fmtDay(r.endDate)}</td>
            <td className="px-4 py-2">{daysText(r.weekdays)}</td>
            {kind === "ADJUST" && <td className="px-4 py-2 tabular-nums">{change(r)}</td>}
            <td className="px-4 py-2 text-muted-foreground">{r.note}</td>
            <td className="px-2"><RemoveButton onRemove={async () => { await client.staff.rateControls.removeRule.mutate({ id: r.id }); await list.refetch(); }} /></td>
          </tr>
        ))}
      </List>
    </div>
  );
}

/** Rate Utilization: % change per utilization tier (0 % … 150 %). */
export function RateUtilization() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const list = useQuery(trpc.staff.rateControls.utilizations.queryOptions());
  const { s, fields } = useScope();
  const [tiers, setTiers] = React.useState<string[]>(Array(16).fill(""));
  const [busy, setBusy] = React.useState(false);
  const now = useQuery({ ...trpc.staff.rateControls.utilizationNow.queryOptions({ locationId: s.locationId, on: new Date(s.startDate || today()) }), enabled: !!s.locationId });

  async function save() {
    setBusy(true);
    try {
      await client.staff.rateControls.addUtilization.mutate({ ...asDates(s), tiers: tiers.map((t) => Number(t) || 0) });
      toast.success("Rate utilization saved");
      setTiers(Array(16).fill(""));
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Find Rate</p>
              {fields}
              {now.data && now.data.length > 0 && (
                <div className="rounded-md border p-3 text-xs">
                  <p className="mb-1 font-medium">Utilization on {fmtDay(s.startDate)}</p>
                  <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                    {now.data.map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.name}</span><span className="tabular-nums text-muted-foreground">{t.booked}/{t.fleet} · {Math.round(t.pct)}%</span></li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Change the daily rate by (%) when the fleet is this full</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
                {TIERS.map((t, i) => (
                  <Field key={t} label={`${t} %`}>
                    <Input type="number" step="0.01" placeholder="0" value={tiers[i]} onChange={(e) => setTiers((x) => x.map((v, k) => (k === i ? e.target.value : v)))} />
                  </Field>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Utilization = bookings and open rentals of the vehicle type on the pickup day ÷ its active fleet at the location. 45 % uses the 40 % box. Use negative numbers to discount when the fleet is quiet.</p>
            </div>
          </div>
          <SaveBar busy={busy} disabled={!s.locationId} onSave={save} />
        </CardContent>
      </Card>
      <List title="Rate utilization rules" empty={!list.data?.length} head={["Location", "Rate", "Vehicle type", "Dates", "Changes"]}>
        {list.data?.map((r) => (
          <tr key={r.id} className="border-t align-top">
            <td className="px-4 py-2">{r.location}</td>
            <td className="px-4 py-2">{r.rate}</td>
            <td className="px-4 py-2">{r.vehicleType}</td>
            <td className="px-4 py-2 whitespace-nowrap">{fmtDay(r.startDate)} – {fmtDay(r.endDate)}</td>
            <td className="px-4 py-2 text-xs tabular-nums">{r.tiers.map((t, i) => (t ? `${i * 10}%: ${t > 0 ? "+" : ""}${t}%` : null)).filter(Boolean).join(" · ")}</td>
            <td className="px-2"><RemoveButton onRemove={async () => { await client.staff.rateControls.removeUtilization.mutate({ id: r.id }); await list.refetch(); }} /></td>
          </tr>
        ))}
      </List>
    </div>
  );
}

/** Overbooking Control: extra bookings allowed past the fleet, per location and vehicle type. */
export function OverbookingControl() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const list = useQuery(trpc.staff.rateControls.overbookings.queryOptions());
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [locIds, setLocIds] = React.useState<string[]>([]);
  const [typeIds, setTypeIds] = React.useState<string[]>([]);
  const [d, setD] = React.useState({ startDate: today(), endDate: today(), overbookBy: "", unit: "UNIT" as "UNIT" | "PERCENT" });
  const [busy, setBusy] = React.useState(false);
  const toggle = (xs: string[], set: (v: string[]) => void, id: string) => set(xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);

  async function save() {
    setBusy(true);
    try {
      const r = await client.staff.rateControls.addOverbooking.mutate({ locationIds: locIds, vehicleTypeIds: typeIds, startDate: new Date(d.startDate), endDate: new Date(d.endDate), overbookBy: Number(d.overbookBy), unit: d.unit });
      toast.success(`Overbooking saved (${r.count})`);
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const Picker = ({ label, items, value, set }: { label: string; items: { id: string; name: string }[]; value: string[]; set: (v: string[]) => void }) => (
    <Field label={label}>
      <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-2 text-sm">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" className="accent-primary" checked={items.length > 0 && value.length === items.length} onChange={(e) => set(e.target.checked ? items.map((i) => i.id) : [])} /> All</label>
        {items.map((i) => <label key={i.id} className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={value.includes(i.id)} onChange={() => toggle(value, set, i.id)} /> {i.name}</label>)}
      </div>
    </Field>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Find Overbooking</p>
              <Picker label="Location *" items={lookups?.locations.filter((l) => l.isActive) ?? []} value={locIds} set={setLocIds} />
              <Picker label="Vehicle Type *" items={lookups?.vehicleTypes ?? []} value={typeIds} set={setTypeIds} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Adjust Overbooking</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From *"><Input type="date" value={d.startDate} onChange={(e) => setD((x) => ({ ...x, startDate: e.target.value }))} /></Field>
                <Field label="To *"><Input type="date" value={d.endDate} onChange={(e) => setD((x) => ({ ...x, endDate: e.target.value }))} /></Field>
                <Field label="Overbook By *"><Input type="number" min={1} value={d.overbookBy} onChange={(e) => setD((x) => ({ ...x, overbookBy: e.target.value }))} /></Field>
                <Field label="Unit">
                  <NativeSelect value={d.unit} onChange={(e) => setD((x) => ({ ...x, unit: e.target.value as "UNIT" }))}>
                    <option value="UNIT">Units (cars)</option>
                    <option value="PERCENT">% of the fleet</option>
                  </NativeSelect>
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">Online, a vehicle type stays bookable for pickups in these dates even with no free car, by this many extra bookings. Staff can always book over.</p>
            </div>
          </div>
          <SaveBar busy={busy} disabled={!locIds.length || !typeIds.length || !d.overbookBy} onSave={save} />
        </CardContent>
      </Card>
      <List title="Overbooking" empty={!list.data?.length} head={["Location", "Vehicle type", "Dates", "Overbook by"]}>
        {list.data?.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="px-4 py-2">{r.location}</td>
            <td className="px-4 py-2">{r.vehicleType}</td>
            <td className="px-4 py-2 whitespace-nowrap">{fmtDay(r.startDate)} – {fmtDay(r.endDate)}</td>
            <td className="px-4 py-2 tabular-nums">{r.overbookBy}{r.unit === "PERCENT" ? "% of fleet" : r.overbookBy === 1 ? " car" : " cars"}</td>
            <td className="px-2"><RemoveButton onRemove={async () => { await client.staff.rateControls.removeOverbooking.mutate({ id: r.id }); await list.refetch(); }} /></td>
          </tr>
        ))}
      </List>
    </div>
  );
}

/** Rates Calendar: the daily price of each rate and vehicle type per day, master or adjusted. */
export function RatesCalendar() {
  const trpc = useTRPC();
  const { s, setS, lookups } = useScope({ rate: false, type: false });
  const [adjusted, setAdjusted] = React.useState(false);
  const [run, setRun] = React.useState<{ locationId: string; startDate: Date; endDate: Date; adjusted: boolean } | null>(null);
  const cal = useQuery({ ...trpc.staff.rateControls.calendar.queryOptions(run ?? { locationId: "", startDate: new Date(), endDate: new Date(), adjusted: false }), enabled: !!run });
  React.useEffect(() => {
    if (!s.locationId && lookups?.locations[0]) {
      const end = new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10);
      setS((x) => ({ ...x, locationId: lookups.locations.find((l) => l.isActive)?.id ?? "", endDate: end }));
    }
  }, [lookups, s.locationId, setS]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Location" className="min-w-64">
            <NativeSelect value={s.locationId} onChange={(e) => setS((x) => ({ ...x, locationId: e.target.value }))}>
              {lookups?.locations.filter((l) => l.isActive).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Begin Date"><Input type="date" value={s.startDate} onChange={(e) => setS((x) => ({ ...x, startDate: e.target.value }))} /></Field>
          <Field label="End Date"><Input type="date" value={s.endDate} onChange={(e) => setS((x) => ({ ...x, endDate: e.target.value }))} /></Field>
          <Field label="Show">
            <NativeSelect value={adjusted ? "1" : ""} onChange={(e) => setAdjusted(!!e.target.value)}>
              <option value="">Display Master Rates</option>
              <option value="1">Display Adjusted Rates</option>
            </NativeSelect>
          </Field>
          <Button type="button" disabled={!s.locationId} onClick={() => setRun({ locationId: s.locationId, startDate: new Date(s.startDate), endDate: new Date(s.endDate), adjusted })}>
            {cal.isFetching && <Loader2Icon className="animate-spin" />}
            Generate
          </Button>
        </CardContent>
      </Card>
      {cal.error && <p className="text-sm text-destructive">{cal.error.message}</p>}
      {cal.data && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {cal.data.rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No online rates with prices for these dates.</p>
            ) : (
              <table className="w-max min-w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">Vehicle type · Rate</th>
                    {cal.data.days.map((d) => {
                      const dt = new Date(d);
                      return <th key={d} className="px-2 py-2 text-right font-medium whitespace-nowrap">{WEEKDAYS[dt.getUTCDay()]}<br />{dt.toLocaleDateString("en-CA", { timeZone: "UTC", month: "short", day: "numeric" })}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {cal.data.rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 whitespace-nowrap"><span className="font-medium">{r.vehicleType}</span> <span className="text-muted-foreground">· {r.rate}</span></td>
                      {r.cells.map((c, k) => (
                        <td key={k} className={cn("px-2 py-1.5 text-right tabular-nums whitespace-nowrap", c === "blocked" && "text-destructive")}>{c === "blocked" ? "Blocked" : c ? `$${c}` : "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
