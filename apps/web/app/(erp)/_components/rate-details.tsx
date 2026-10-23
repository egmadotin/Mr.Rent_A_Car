"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";

/** Same shape as the API's rateOverrideInput (packages/api/src/lib/rate-override.ts). */
export type RateOverride = {
  hourly?: number | null;
  daily?: number | null;
  extraDaily?: number | null;
  weekly?: number | null;
  monthly?: number | null;
  fuelCharge?: number | null;
  kmHourly?: number | null;
  kmDaily?: number | null;
  kmWeekly?: number | null;
  kmMonthly?: number | null;
  kmCharge?: number | null;
  propaneUnitCharge?: number | null;
  overrideDateSpecific?: boolean;
};
type Key = Exclude<keyof RateOverride, "overrideDateSpecific">;

/** RentCentric RateDetails.aspx layout: rates on the left, km on the right. */
const LEFT: [Key, string][] = [["hourly", "Hourly"], ["daily", "Daily"], ["extraDaily", "Extra Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["fuelCharge", "Fuel Charge"]];
const RIGHT: [Key, string][] = [["kmHourly", "KM Hourly"], ["kmDaily", "KM Daily"], ["kmWeekly", "KM Weekly"], ["kmMonthly", "KM Monthly"], ["kmCharge", "KM Charge"], ["propaneUnitCharge", "Propane Unit Charge"]];
const KM = new Set<Key>(["kmHourly", "kmDaily", "kmWeekly", "kmMonthly"]);

export const hasRateOverride = (o: RateOverride | null | undefined) => !!o && (Object.entries(o).some(([k, v]) => k !== "overrideDateSpecific" && v != null) || !!o.overrideDateSpecific);

/**
 * "Rate (i)" next to Rate: this booking's own rate values (RentCentric Rate Details). Each box shows the rate's value;
 * a box left blank keeps it. Saved with the booking, so later re-prices (End Rental, edits) keep the override.
 */
export function RateDetailsButton({
  rateValues,
  value,
  onChange,
  disabled,
}: {
  rateValues?: Partial<Record<Key, string | number | null>>;
  value: RateOverride | null | undefined;
  onChange: (v: RateOverride | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [dateSpecific, setDateSpecific] = React.useState(false);
  const active = hasRateOverride(value);

  const show = () => {
    setDraft(Object.fromEntries([...LEFT, ...RIGHT].map(([k]) => [k, value?.[k] == null ? "" : String(value[k])])));
    setDateSpecific(!!value?.overrideDateSpecific);
    setOpen(true);
  };
  const save = () => {
    const o: RateOverride = { overrideDateSpecific: dateSpecific || undefined };
    for (const [k] of [...LEFT, ...RIGHT]) {
      const t = draft[k]?.trim();
      o[k] = t ? (KM.has(k) ? Math.round(Number(t)) : Number(t)) : null;
    }
    onChange(hasRateOverride(o) ? o : null);
    setOpen(false);
  };
  const box = ([k, label]: [Key, string]) => (
    <div key={k} className="space-y-1">
      <Label htmlFor={`rd-${k}`}>{label}</Label>
      <Input
        id={`rd-${k}`}
        type="number"
        min={0}
        step={KM.has(k) ? "1" : "0.01"}
        value={draft[k] ?? ""}
        placeholder={rateValues?.[k] != null ? String(rateValues[k]) : ""}
        onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
      />
    </div>
  );

  return (
    <>
      <Button
        type="button"
        size="icon-sm"
        variant={active ? "ink" : "ghost"}
        onClick={show}
        disabled={disabled}
        aria-label={active ? "Rate details (changed for this booking)" : "Rate details"}
        title={disabled ? "Choose a rate first" : active ? "Rate details — changed for this booking" : "Rate details"}
      >
        <InfoIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rate Details</DialogTitle>
            <DialogDescription>This booking&apos;s own rate. Each box shows the rate&apos;s value; leave it blank to keep it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">{LEFT.map(box)}</div>
            <div className="space-y-3">{RIGHT.map(box)}</div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={dateSpecific} onChange={(e) => setDateSpecific(e.target.checked)} /> Override Date Specific Rate
          </label>
          <DialogFooter>
            {active && <Button type="button" variant="outline" onClick={() => { onChange(null); setOpen(false); }}>Use the rate&apos;s values</Button>}
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
