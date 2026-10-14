"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { cn } from "@mrac/ui/lib/utils";
import { CheckField, Field, FormErrorsContext, SelectField, errorMessage, fieldErrorsOf, formToObject } from "../../../../_components/form";

/** Legacy "Rate Type" list (RatesModifyNew2.aspx). */
const RATE_TYPES = [
  "Standard",
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} Day Multiday`),
  "5 Hour Flat", "Hourly Rate Only", "Daily Rate Only", "Weekly Rate Only", "Monthly Rate Only", "Weekend", "Min/Max Days", "Min/Max+Regular",
  ...Array.from({ length: 30 }, (_, i) => `${i + 1} Day Flat`),
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COLS = [
  ["hourly", "Hourly"], ["daily", "Daily"], ["extraDaily", "Extra daily"], ["weekly", "Weekly"], ["monthly", "Monthly"],
  ["kmHourly", "KM hourly"], ["kmAllowed", "KM daily"], ["kmWeekly", "KM weekly"], ["kmMonthly", "KM monthly"], ["extraKmCharge", "Extra KM charge"],
] as const;

type Value = { vehicleTypeId: string; seasonId: string | null } & Partial<Record<(typeof COLS)[number][0], string | number | null>>;
type Rate = Record<string, unknown> & { seasons?: { seasonId: string }[]; values?: Value[]; availableDays?: boolean[] };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : "");
const key = (t: string, season: string | null) => `${t}|${season ?? ""}`;

export function RateForm({ id, initial, defaultLocationId }: { id?: string; initial?: Rate; defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const v = initial ?? {};
  const [validFor, setValidFor] = React.useState(s(v.validFor) || "DATE_RANGE");
  const [seasonIds, setSeasonIds] = React.useState<string[]>((v.seasons ?? []).map((x) => x.seasonId));
  const [activeSeason, setActiveSeason] = React.useState<string | null>(seasonIds[0] ?? null);
  const [values, setValues] = React.useState<Map<string, Value>>(
    () => new Map((v.values ?? []).map((x) => [key(x.vehicleTypeId, x.seasonId), { ...x }])),
  );
  const [onlyPriced, setOnlyPriced] = React.useState(!!id);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const season = validFor === "SEASON" ? activeSeason : null;
  React.useEffect(() => {
    if (validFor === "SEASON" && (!activeSeason || !seasonIds.includes(activeSeason))) setActiveSeason(seasonIds[0] ?? null);
  }, [validFor, seasonIds, activeSeason]);

  const setCell = (typeId: string, col: string, val: string) =>
    setValues((m) => {
      const n = new Map(m);
      const k = key(typeId, season);
      n.set(k, { ...(n.get(k) ?? { vehicleTypeId: typeId, seasonId: season }), [col]: val });
      return n;
    });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    const f = formToObject(e.currentTarget) as Record<string, unknown>;
    const availableDays = DAYS.map((_, i) => f[`day${i}`] === true);
    for (let i = 0; i < 7; i++) delete f[`day${i}`];
    const data = { ...f, validFor, seasonIds, availableDays };
    const rows = [...values.values()].filter((x) => validFor !== "SEASON" || (x.seasonId && seasonIds.includes(x.seasonId)));
    try {
      const res = await client.staff.settings.rateSave.mutate({ id, data: data as never, values: rows as never });
      toast.success("Rate saved");
      router.push(`/admin/settings/rates/${res.id}`);
      router.refresh();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, val]) => [k.replace(/^data\./, ""), val])));
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!lookups) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const priced = (t: string) => {
    const x = values.get(key(t, season));
    return !!x && COLS.some(([c]) => x[c] !== null && x[c] !== undefined && x[c] !== "");
  };
  const types = onlyPriced ? lookups.vehicleTypes.filter((t) => priced(t.id)) : lookups.vehicleTypes;

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-4 md:p-6">
        {formError && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon className="size-4" /> {formError}
          </div>
        )}
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Rate code" name="code" required defaultValue={s(v.code)} />
            <SelectField label="Location" name="locationId" required placeholder={false} options={lookups.locations.map((l) => ({ value: l.id, label: l.name }))} defaultValue={s(v.locationId) || defaultLocationId} />
            <SelectField label="Calculation by" name="calculationBy" placeholder={false} options={[{ value: "HOUR_24", label: "24 Hour Time" }, { value: "CALENDAR_DAY", label: "Calender Day" }, { value: "FLAT", label: "Flat" }]} defaultValue={s(v.calculationBy) || "HOUR_24"} />
            <SelectField label="Rate type" name="rateType" required placeholder={false} options={RATE_TYPES} defaultValue={s(v.rateType) || "Standard"} />
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="mb-1.5 text-sm font-medium">Min days / hours / min</legend>
              <Input name="minDays" type="number" min={0} defaultValue={s(v.minDays ?? 0)} aria-label="Min days" />
              <Input name="minHours" type="number" min={0} max={23} defaultValue={s(v.minHours ?? 0)} aria-label="Min hours" />
              <Input name="minMinutes" type="number" min={0} max={59} defaultValue={s(v.minMinutes ?? 0)} aria-label="Min minutes" />
            </fieldset>
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="mb-1.5 text-sm font-medium">Max days / hours / min</legend>
              <Input name="maxDays" type="number" min={0} defaultValue={s(v.maxDays ?? 0)} aria-label="Max days" />
              <Input name="maxHours" type="number" min={0} max={23} defaultValue={s(v.maxHours ?? 0)} aria-label="Max hours" />
              <Input name="maxMinutes" type="number" min={0} max={59} defaultValue={s(v.maxMinutes ?? 0)} aria-label="Max minutes" />
            </fieldset>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="validFor">Available by</label>
              <NativeSelect id="validFor" value={validFor} onChange={(e) => setValidFor(e.target.value)}>
                <option value="DATE_RANGE">Date range</option>
                <option value="SEASON">Season</option>
              </NativeSelect>
            </div>
            {validFor === "DATE_RANGE" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Effective" name="effectiveDate" type="date" defaultValue={iso(v.effectiveDate)} />
                <Field label="End" name="endDate" type="date" defaultValue={iso(v.endDate)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Seasons</span>
                <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                  {lookups.seasons.map((x) => (
                    <label key={x.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={seasonIds.includes(x.id)}
                        onChange={(e) => setSeasonIds((ids) => (e.target.checked ? [...ids, x.id] : ids.filter((i) => i !== x.id)))}
                      />
                      {x.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Field label="Extra KM charge" name="extraKmCharge" type="number" step="0.01" min={0} required defaultValue={s(v.extraKmCharge ?? 0)} />
            <Field label="Grace minutes" name="graceMinutes" type="number" min={0} required defaultValue={s(v.graceMinutes ?? 0)} />
            <Field label="Fuel charge per gallon/litre" name="fuelChargePerUnit" type="number" step="0.01" min={0} required defaultValue={s(v.fuelChargePerUnit ?? 0)} />
            <Field label="Minimum charge days" name="minChargeDays" type="number" min={0} required defaultValue={s(v.minChargeDays ?? 0)} />
            <Field label="Minimum charge hours" name="minChargeHours" type="number" min={0} defaultValue={s(v.minChargeHours ?? 0)} />
            <div className="flex flex-col gap-1.5">
              <CheckField label="Skip hourly rate" name="skipHourly" defaultChecked={v.skipHourly === true} />
              <CheckField label="Active" name="isActive" defaultChecked={v.isActive !== false} />
              <CheckField label="Display online" name="displayOnline" defaultChecked={v.displayOnline === true} />
              <CheckField label="Value pricing" name="valuePricing" defaultChecked={v.valuePricing === true} />
              <CheckField label="Date specific rate" name="dateSpecific" defaultChecked={v.dateSpecific === true} />
              <CheckField label="Rentcars.com" name="rentcarsCom" defaultChecked={v.rentcarsCom === true} />
            </div>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Available on</legend>
              {DAYS.map((d, i) => (
                <CheckField key={d} label={d} name={`day${i}`} defaultChecked={(v.availableDays ?? [])[i] !== false} />
              ))}
            </fieldset>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Rental rates</CardTitle>
              <CardDescription>Price per vehicle type{validFor === "SEASON" ? " for the selected season" : ""}. Leave a row empty to exclude the type.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {validFor === "SEASON" && (
                <NativeSelect className="w-56" value={activeSeason ?? ""} onChange={(e) => setActiveSeason(e.target.value || null)} aria-label="Season">
                  {seasonIds.length === 0 && <option value="">Tick a season first</option>}
                  {lookups.seasons.filter((x) => seasonIds.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </NativeSelect>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={onlyPriced} onChange={(e) => setOnlyPriced(e.target.checked)} /> Only priced types
              </label>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Vehicle type</th>
                  {COLS.map(([, l]) => <th key={l} className="px-1 py-2 text-right font-medium">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const row = values.get(key(t.id, season));
                  return (
                    <tr key={t.id} className={cn("border-b last:border-0", priced(t.id) && "bg-accent/30")}>
                      <td className="px-3 py-1.5 whitespace-nowrap">{t.name}</td>
                      {COLS.map(([c, l]) => (
                        <td key={c} className="px-1 py-1">
                          <input
                            type="number"
                            step={c.startsWith("km") ? 1 : 0.01}
                            min={0}
                            aria-label={`${t.name} ${l}`}
                            disabled={validFor === "SEASON" && !season}
                            className="h-8 w-24 rounded-md border bg-transparent px-2 text-right tabular-nums focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                            value={s(row?.[c])}
                            onChange={(e) => setCell(t.id, c, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {types.length === 0 && (
                  <tr><td colSpan={COLS.length + 1} className="px-3 py-6 text-center text-muted-foreground">No priced types{validFor === "SEASON" ? " in this season" : ""}. Untick “Only priced types” to add prices.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href="/admin/settings/rates">Cancel</Link></Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />} Save rate</Button>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
