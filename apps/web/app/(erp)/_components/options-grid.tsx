"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";

export type BookingOptions = {
  insuranceIds: string[];
  miscCharges: { miscChargeId: string; quantity: number }[];
  excludedTaxIds: string[];
  otherCharges: { amount: number; detail?: string | null; description?: string | null }[];
};
export const emptyOptions = (): BookingOptions => ({ insuranceIds: [], miscCharges: [], excludedTaxIds: [], otherCharges: [] });

/** Rate dropdown + options grid data for the chosen location / vehicle type / pickup date. */
export function useBookingOptions(locationId: string, vehicleTypeId: string, at: Date | null, returnAt?: Date | null) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.staff.booking.options.queryOptions({ locationId, vehicleTypeId, at: at ?? new Date(), returnAt: returnAt && !Number.isNaN(+returnAt) ? returnAt : undefined }),
    placeholderData: (p) => p,
    enabled: !!locationId && !!vehicleTypeId && !!at && !Number.isNaN(+at),
  });
}
export type BookingOptionsData = NonNullable<ReturnType<typeof useBookingOptions>["data"]>;

/**
 * Legacy options grid (Option Name · Type · Rate):
 * - insurances and ungrouped charges are tick boxes; charges sharing a group are pick-one radios with a clear (x)
 * - taxes are listed ticked; untick to make the booking tax-exempt
 * - "Default" charges are pre-ticked when the grid first loads for a new booking
 * - "Add/Edit Other Charges": four free lines (amount, detail, description)
 */
export function OptionsGrid({
  data,
  value,
  onChange,
  applyDefaults,
  paymentDetails,
}: {
  data: BookingOptionsData | undefined;
  /** Settings > Payment Details names, for the Other Charges "Detail" list */
  paymentDetails?: string[];
  value: BookingOptions;
  onChange: (v: BookingOptions) => void;
  /** pre-tick defaults once (new bookings only) */
  applyDefaults: boolean;
}) {
  const [showOther, setShowOther] = React.useState(value.otherCharges.length > 0);
  // RentCentric re-ticks the defaults whenever the location / vehicle type (and so the option list) changes
  const applied = React.useRef("");
  React.useEffect(() => {
    if (!data || !applyDefaults) return;
    const key = [...data.insurances.map((i) => i.id), ...data.misc.map((m) => m.id)].join(",");
    if (applied.current === key) return;
    applied.current = key;
    const defaults = data.misc.filter((m) => m.isDefault);
    const seen = new Set<string>();
    onChange({
      ...value,
      insuranceIds: data.insurances.filter((i) => i.isDefault).map((i) => i.id),
      miscCharges: defaults
        .filter((m) => (m.group ? (seen.has(m.group) ? false : (seen.add(m.group), true)) : true))
        .map((m) => ({ miscChargeId: m.id, quantity: 1 })),
    });
  }, [data, applyDefaults, onChange, value]);

  // like RentCentric, the empty grid (headers + Add/Edit Other Charges) shows before a vehicle type is chosen
  const d: Pick<BookingOptionsData, "insurances" | "misc" | "taxes"> = data ?? { insurances: [], misc: [], taxes: [] };

  const has = (id: string) => value.miscCharges.some((m) => m.miscChargeId === id);
  const qty = (id: string) => value.miscCharges.find((m) => m.miscChargeId === id)?.quantity ?? 0;
  const setMisc = (id: string, on: boolean, group?: string | null) => {
    let next = value.miscCharges.filter((m) => m.miscChargeId !== id);
    if (on) {
      if (group) {
        const sameGroup = new Set(d.misc.filter((m) => m.group === group).map((m) => m.id));
        next = next.filter((m) => !sameGroup.has(m.miscChargeId));
      }
      next.push({ miscChargeId: id, quantity: 1 });
    }
    onChange({ ...value, miscCharges: next });
  };
  const clearGroup = (group: string) => {
    const ids = new Set(d.misc.filter((m) => m.group === group).map((m) => m.id));
    onChange({ ...value, miscCharges: value.miscCharges.filter((m) => !ids.has(m.miscChargeId)) });
  };
  const toggleIns = (id: string, on: boolean, group?: string | null) => {
    let ids = value.insuranceIds.filter((x) => x !== id);
    if (on && group) {
      const same = new Set(d.insurances.filter((i) => i.group === group).map((i) => i.id));
      ids = ids.filter((x) => !same.has(x));
    }
    onChange({ ...value, insuranceIds: on ? [...ids, id] : ids });
  };
  const clearInsGroup = (group: string) => {
    const same = new Set(d.insurances.filter((i) => i.group === group).map((i) => i.id));
    onChange({ ...value, insuranceIds: value.insuranceIds.filter((x) => !same.has(x)) });
  };
  const toggleTax = (id: string, on: boolean) =>
    onChange({ ...value, excludedTaxIds: on ? value.excludedTaxIds.filter((x) => x !== id) : [...value.excludedTaxIds, id] });

  // ungrouped first, then each group; plain character order like RentCentric ("&" sorts before "(")
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const byGroup = <T extends { group: string | null; name: string }>(xs: T[]) =>
    [...xs].sort((a, b) => Number(!!a.group) - Number(!!b.group) || cmp(a.group ?? "", b.group ?? "") || cmp(a.name, b.name));
  // a group with a single member is shown as a plain tick box
  const count = (xs: { group: string | null }[], g: string | null) => (g ? xs.filter((x) => x.group === g).length : 0);
  const rows: { key: string; control: React.ReactNode; name: string; type: string; rate: string; on: boolean }[] = [
    ...byGroup(d.insurances).map((i) => ({
      key: `i${i.id}`,
      on: value.insuranceIds.includes(i.id),
      control: count(d.insurances, i.group) > 1 ? (
        <span className="flex items-center gap-1">
          <input type="radio" className="accent-primary" name={`ins-${i.group}`} checked={value.insuranceIds.includes(i.id)} onChange={() => toggleIns(i.id, true, i.group)} aria-label={i.name} />
          <button type="button" className="text-muted-foreground hover:text-destructive" title="Clear this group" onClick={() => clearInsGroup(i.group!)}>
            <XIcon className="size-3.5" />
          </button>
        </span>
      ) : (
        <input type="checkbox" className="accent-primary" checked={value.insuranceIds.includes(i.id)} onChange={(e) => toggleIns(i.id, e.target.checked)} aria-label={i.name} />
      ),
      // RentCentric shows name / type / rate only
      name: i.name,
      type: "Insurance",
      rate: money(i.dailyRate),
    })),
    ...byGroup(d.misc).map((m) => ({
      key: `m${m.id}`,
      on: has(m.id),
      control: count(d.misc, m.group) > 1 ? (
        <span className="flex items-center gap-1">
          <input type="radio" className="accent-primary" name={`grp-${m.group}`} checked={has(m.id)} onChange={() => setMisc(m.id, true, m.group)} aria-label={m.name} />
          <button type="button" className="text-muted-foreground hover:text-destructive" title="Clear this group" onClick={() => clearGroup(m.group!)}>
            <XIcon className="size-3.5" />
          </button>
        </span>
      ) : (
        <input type="checkbox" className="accent-primary" checked={has(m.id)} onChange={(e) => setMisc(m.id, e.target.checked)} aria-label={m.name} />
      ),
      name: m.name,
      type: "Misc. Charge",
      rate: m.calculationBy === "PERCENT" ? `${Number(m.rate)}%` : money(m.rate),
    })),
    ...d.taxes.map((t) => ({
      key: `t${t.id}`,
      on: !value.excludedTaxIds.includes(t.id),
      control: <input type="checkbox" className="accent-primary" checked={!value.excludedTaxIds.includes(t.id)} onChange={(e) => toggleTax(t.id, e.target.checked)} aria-label={t.name} />,
      name: t.name,
      type: "Tax",
      rate: t.kind === "PERCENT" ? `${Number(t.value)}%` : money(t.value),
    })),
  ];

  const other = [0, 1, 2, 3].map((i) => value.otherCharges[i] ?? { amount: 0, detail: "", description: "" });
  const setOther = (i: number, patch: Partial<(typeof other)[number]>) => {
    const next = other.map((o, k) => (k === i ? { ...o, ...patch } : o));
    onChange({ ...value, otherCharges: next.filter((o) => o.amount || o.description || o.detail) });
  };

  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2" />
              <th className="px-2 py-2 font-medium">Option Name</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = r.key.slice(1);
              const m = r.key.startsWith("m") ? d.misc.find((x) => x.id === id) : null;
              return (
                <tr key={r.key} className={cn("border-t", r.on && "bg-accent/40")}>
                  <td className="px-3 py-1.5">{r.control}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.type}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.rate}</td>
                  <td className="px-2 py-1">
                    {m && has(m.id) && (m.multiSelect || m.autoWhenAdditionalDriver) && (
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        aria-label={`${m.name} quantity`}
                        className="h-7 w-14 px-1 text-right"
                        value={qty(m.id)}
                        onChange={(e) =>
                          onChange({ ...value, miscCharges: value.miscCharges.map((x) => (x.miscChargeId === m.id ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)) })
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => setShowOther((x) => !x)} aria-expanded={showOther} className="flex items-center gap-1 text-sm font-medium text-primary">
        <ChevronDownIcon className={cn("size-4 transition-transform", showOther && "rotate-180")} /> Add/Edit Other Charges
        {value.otherCharges.length > 0 && <span className="text-muted-foreground"> ({value.otherCharges.length})</span>}
      </button>
      {showOther && (
        <div className="grid gap-2">
          {other.map((o, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr_2fr] gap-2">
              <Input type="number" step="0.01" aria-label={`Other charge ${i + 1} amount`} placeholder="0.00" value={o.amount || ""} onChange={(e) => setOther(i, { amount: Number(e.target.value) || 0 })} />
              {/* Detail = Settings > Payment Details list (OtherChargesAdd.aspx PayDetailList) */}
              <NativeSelect aria-label={`Other charge ${i + 1} detail`} value={o.detail ?? ""} onChange={(e) => setOther(i, { detail: e.target.value })}>
                <option value="" />
                {[...new Set([...(paymentDetails ?? []), ...(o.detail ? [o.detail] : [])])].map((d) => <option key={d} value={d}>{d}</option>)}
              </NativeSelect>
              <Input aria-label={`Other charge ${i + 1} description`} placeholder="Description" value={o.description ?? ""} onChange={(e) => setOther(i, { description: e.target.value })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
