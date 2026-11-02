"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import type { RateOverride } from "./rate-details";

export type BookingOptions = {
  insuranceIds: string[];
  miscCharges: { miscChargeId: string; quantity: number }[];
  excludedTaxIds: string[];
  otherCharges: { amount: number; detail?: string | null; description?: string | null }[];
  /** "Rate (i)" Rate Details (see rate-details.tsx) */
  rateOverride?: RateOverride | null;
};
type Opt = {
  key: string;
  type: "Insurance" | "Misc. Charge" | "Tax";
  name: string;
  rate: string;
  on: boolean;
  /** pick-one group name (only for groups with two or more members) */
  group: string | null;
  toggle: () => void;
  /** quantity box for multi-select charges */
  extra?: React.ReactNode;
};

/** One option as a click-anywhere tile: tick box (or radio for a pick-one group), name, rate. */
function OptionTile({ r }: { r: Opt }) {
  return (
    <div className={cn("flex min-h-8 items-center rounded-md border bg-background text-[13px] transition-colors", r.on ? "border-primary/60 bg-primary/10" : "hover:bg-muted/60")}>
      <button
        type="button"
        role={r.group ? "radio" : "checkbox"}
        aria-checked={r.on}
        aria-label={r.name}
        title={r.name}
        onClick={r.toggle}
        className="flex min-h-8 min-w-0 flex-1 items-center gap-2 px-2.5 py-1 text-left leading-tight"
      >
        <span
          className={cn(
            "grid size-4 shrink-0 place-items-center border",
            r.group ? "rounded-full" : "rounded-[4px]",
            r.on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
          )}
        >
          {r.on && (r.group ? <span className="size-1.5 rounded-full bg-current" /> : <CheckIcon className="size-3" strokeWidth={3} />)}
        </span>
        <span className="line-clamp-2 min-w-0 flex-1">{r.name}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{r.rate}</span>
      </button>
      {r.extra}
    </div>
  );
}

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
 * - client request: a search box, Insurance / Misc. / Taxes / Selected tabs with counts, and the chosen options as
 *   removable chips, so a long list needs no scrolling to find or check a charge
 * - laid out as tiles across the whole width (no inner scroll box); pick-one groups are small cards, click a picked
 *   one again (or Clear) to unpick
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
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"all" | "Insurance" | "Misc. Charge" | "Tax" | "selected">("all");
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
  const qtyInput = (m: BookingOptionsData["misc"][number]) =>
    has(m.id) && (m.multiSelect || m.autoWhenAdditionalDriver) ? (
      <Input
        type="number"
        min={1}
        max={20}
        aria-label={`${m.name} quantity`}
        className="mr-1 h-7 w-12 shrink-0 px-1 text-right"
        value={qty(m.id)}
        onChange={(e) =>
          onChange({ ...value, miscCharges: value.miscCharges.map((x) => (x.miscChargeId === m.id ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)) })
        }
      />
    ) : null;
  const rows: Opt[] = [
    ...byGroup(d.insurances).map((i): Opt => {
      const on = value.insuranceIds.includes(i.id);
      const group = count(d.insurances, i.group) > 1 ? i.group : null;
      // RentCentric shows name / type / rate only
      return {
        key: `i${i.id}`, on, group, name: i.name, type: "Insurance", rate: money(i.dailyRate),
        toggle: () => (group ? (on ? clearInsGroup(group) : toggleIns(i.id, true, group)) : toggleIns(i.id, !on)),
      };
    }),
    ...byGroup(d.misc).map((m): Opt => {
      const on = has(m.id);
      const group = count(d.misc, m.group) > 1 ? m.group : null;
      return {
        key: `m${m.id}`, on, group, name: m.name, type: "Misc. Charge",
        rate: m.calculationBy === "PERCENT" ? `${Number(m.rate)}%` : money(m.rate),
        toggle: () => (group ? (on ? clearGroup(group) : setMisc(m.id, true, group)) : setMisc(m.id, !on)),
        extra: qtyInput(m),
      };
    }),
    ...d.taxes.map((t): Opt => {
      const on = !value.excludedTaxIds.includes(t.id);
      return {
        key: `t${t.id}`, on, group: null, name: t.name, type: "Tax",
        rate: t.kind === "PERCENT" ? `${Number(t.value)}%` : money(t.value),
        toggle: () => toggleTax(t.id, !on),
      };
    }),
  ];

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(
    (r) => (tab === "all" || (tab === "selected" ? r.on && r.type !== "Tax" : r.type === tab)) && words.every((w) => r.name.toLowerCase().includes(w)),
  );
  const chosen = rows.filter((r) => r.on && r.type !== "Tax");
  const remove = (key: string) => {
    const id = key.slice(1);
    if (key.startsWith("i")) toggleIns(id, false);
    else if (key.startsWith("m")) setMisc(id, false);
  };
  const tabs = [
    { key: "all" as const, label: "All", n: rows.length },
    { key: "Insurance" as const, label: "Insurance", n: d.insurances.length },
    { key: "Misc. Charge" as const, label: "Misc. charges", n: d.misc.length },
    { key: "Tax" as const, label: "Taxes", n: d.taxes.length },
    { key: "selected" as const, label: "Selected", n: chosen.length },
  ];

  const section = (type: Opt["type"], title: string) => {
    const items = shown.filter((r) => r.type === type);
    if (!items.length) return null;
    const loose = items.filter((r) => !r.group);
    const groups = [...new Set(items.filter((r) => r.group).map((r) => r.group!))];
    return (
      <section key={type} className="space-y-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title} <span className="font-normal tabular-nums">· {items.filter((r) => r.on).length} of {items.length} on</span>
        </h3>
        {/* balanced columns (as many as fit): pick-one cards first, then the tick boxes */}
        <div className="columns-[15rem] gap-2 *:mb-1.5 *:break-inside-avoid">
          {groups.map((g) => {
            const members = items.filter((r) => r.group === g);
            const picked = members.find((r) => r.on);
            return (
              <div key={g} className="space-y-1 rounded-lg border bg-muted/20 p-1.5">
                <div className="flex items-center justify-between gap-2 px-1 text-xs">
                  <span className="truncate font-medium" title={g}>{g} <span className="font-normal text-muted-foreground">· pick one</span></span>
                  {picked && (
                    <button type="button" onClick={picked.toggle} className="shrink-0 text-muted-foreground hover:text-destructive">Clear</button>
                  )}
                </div>
                {members.map((r) => <OptionTile key={r.key} r={r} />)}
              </div>
            );
          })}
          {loose.map((r) => <OptionTile key={r.key} r={r} />)}
        </div>
      </section>
    );
  };
  const ins = section("Insurance", "Insurance");
  const misc = section("Misc. Charge", "Misc. charges");
  const tax = section("Tax", "Taxes");

  const other = [0, 1, 2, 3].map((i) => value.otherCharges[i] ?? { amount: 0, detail: "", description: "" });
  const setOther = (i: number, patch: Partial<(typeof other)[number]>) => {
    const next = other.map((o, k) => (k === i ? { ...o, ...patch } : o));
    onChange({ ...value, otherCharges: next.filter((o) => o.amount || o.description || o.detail) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search options" placeholder="Search options (e.g. seat, waiver, GPS)" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1" role="tablist" aria-label="Option type">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn("rounded px-2.5 py-1 text-xs font-medium", tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
            </button>
          ))}
        </div>
      </div>
      {chosen.length > 0 && (words.length > 0 || (tab !== "all" && tab !== "selected")) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Selected:</span>
          {chosen.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border bg-accent/40 py-0.5 pr-1 pl-2.5">
              {c.name} <span className="text-muted-foreground">{c.rate}</span>
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => remove(c.key)} className="rounded-full p-0.5 hover:bg-muted"><XIcon className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      {shown.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {rows.length ? "No options match." : "Choose a vehicle type to see the options."}
        </p>
      )}
      {/* wide screens: Insurance and Taxes in a narrow pane, the long Misc. charges list across the rest */}
      <div className="@container">
        <div className={cn("grid items-start gap-4", (ins || tax) && misc && "@4xl:grid-cols-[17rem_minmax(0,1fr)] @6xl:grid-cols-[19rem_minmax(0,1fr)]")}>
          {(ins || tax) && <div className="space-y-4">{ins}{tax}</div>}
          {misc}
        </div>
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
