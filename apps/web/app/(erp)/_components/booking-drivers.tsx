"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon, SearchIcon, UserMinusIcon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { date, fullName } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { cn } from "@mrac/ui/lib/utils";
import { errorMessage, fieldErrorsOf } from "./form";
import type { BookingOptions, BookingOptionsData } from "./options-grid";

/** An additional driver picked on the form (an existing customer). */
export type DriverPick = { id: string; firstName: string; lastName: string; licenseNumber: string | null; licenseExpiry: Date | string | null };

/**
 * Keep the "Additional driver is added" charges (Settings > Misc Charges) ticked in the options grid with one unit per
 * additional driver, as RentCentric adds them when drivers are added; with no drivers they are unticked.
 */
export function withDriverCharges(opts: BookingOptions, data: BookingOptionsData | undefined, count: number): BookingOptions {
  const ids = new Set((data?.misc ?? []).filter((m) => m.autoWhenAdditionalDriver).map((m) => m.id));
  if (!ids.size) return opts;
  const rest = opts.miscCharges.filter((m) => !ids.has(m.miscChargeId));
  return { ...opts, miscCharges: count > 0 ? [...rest, ...[...ids].map((id) => ({ miscChargeId: id, quantity: count }))] : rest };
}

/**
 * "Drivers / Add More Drivers" on the Customer tab: additional drivers saved with the booking. Adding happens right in
 * the card (client request: no second pop-up over the More window) — find an existing customer, or enter a New driver
 * who isn't a customer yet (saved as a customer with the driver details).
 */
export function DriversCard({ drivers, onChange, primaryId }: { drivers: DriverPick[]; onChange: (d: DriverPick[]) => void; primaryId?: string | null }) {
  const [adding, setAdding] = React.useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Drivers</CardTitle>
        {!adding && <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}><PlusIcon /> Add More Drivers</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional drivers.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {drivers.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 p-2">
                <span>
                  <Link href={`/admin/customers/${d.id}`} target="_blank" className="font-medium text-primary hover:underline">{fullName(d)}</Link>{" "}
                  <span className="text-muted-foreground">Licence {d.licenseNumber ?? "—"} · exp. {date(d.licenseExpiry)}</span>
                </span>
                <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={`Remove ${fullName(d)}`} onClick={() => onChange(drivers.filter((x) => x.id !== d.id))}>
                  <UserMinusIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <AddDriver
            exclude={[...drivers.map((d) => d.id), ...(primaryId ? [primaryId] : [])]}
            onPick={(c) => {
              onChange([...drivers, c]);
              setAdding(false);
            }}
            onClose={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** The add-a-driver panel inside the card: Find customer | New driver. */
function AddDriver({ exclude, onPick, onClose }: { exclude: string[]; onPick: (c: DriverPick) => void; onClose: () => void }) {
  const [tab, setTab] = React.useState<"find" | "new">("find");
  const tabs: ["find" | "new", string][] = [["find", "Find customer"], ["new", "New driver"]];
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Add a driver">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("rounded-full border px-3 py-1 text-sm", tab === k ? "border-primary/60 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      </div>
      {tab === "find" ? <FindDriver exclude={exclude} onPick={onPick} onNew={() => setTab("new")} /> : <NewDriver onPick={onPick} />}
    </div>
  );
}

function FindDriver({ exclude, onPick, onNew }: { exclude: string[]; onPick: (c: DriverPick) => void; onNew: () => void }) {
  const trpc = useTRPC();
  const [q, setQ] = React.useState("");
  const results = useQuery({ ...trpc.staff.rental.searchDrivers.queryOptions({ q }), enabled: q.trim().length >= 2 });
  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Name, licence # or phone" autoFocus aria-label="Search customers" />
      </div>
      {q.trim().length >= 2 && (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-md border bg-card">
          {results.isFetching && !results.data && <li className="p-3 text-sm text-muted-foreground">Searching…</li>}
          {results.data?.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">
              No customers found.{" "}
              <button type="button" onClick={onNew} className="text-primary hover:underline">Enter a new driver</button>
            </li>
          )}
          {results.data?.map((c) => {
            const already = exclude.includes(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <div>
                  <div className="font-medium">{fullName(c)} {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}</div>
                  <div className="text-xs text-muted-foreground">Licence {c.licenseNumber ?? "—"} · exp. {date(c.licenseExpiry)}</div>
                </div>
                <Button type="button" size="sm" disabled={already || c.isUndesired} onClick={() => onPick(c)}>{already ? "Added" : "Add"}</Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type NewDriverValues = { firstName: string; lastName: string; licenseNumber: string; licenseExpiry: string; licenseProvince: string; birthDate: string; phone: string };

/** A driver who isn't a customer yet: the driver details, saved as a customer and added. */
function NewDriver({ onPick }: { onPick: (c: DriverPick) => void }) {
  const client = useTRPCClient();
  const [v, setV] = React.useState<NewDriverValues>({ firstName: "", lastName: "", licenseNumber: "", licenseExpiry: "", licenseProvince: "British Columbia", birthDate: "", phone: "" });
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [pending, setPending] = React.useState(false);
  const field = (k: keyof NewDriverValues, label: string, opts: { type?: string; required?: boolean } = {}) => (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={`nd-${k}`}>
        {label}
        {opts.required && <span className="text-destructive" aria-hidden>*</span>}
      </Label>
      <Input id={`nd-${k}`} type={opts.type ?? "text"} autoComplete="off" value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} aria-invalid={errors[k] ? true : undefined} />
      {errors[k]?.[0] && <p className="text-xs text-destructive">{errors[k]![0]}</p>}
    </div>
  );
  async function add() {
    const required: (keyof NewDriverValues)[] = ["firstName", "lastName", "licenseNumber", "licenseExpiry"];
    const missing = required.filter((k) => !v[k].trim());
    if (missing.length) return setErrors(Object.fromEntries(missing.map((k) => [k, ["Required"]])));
    setPending(true);
    setErrors({});
    try {
      // a date-only value, as the customer form saves it
      const c = await client.staff.rental.newDriver.mutate({ ...v, licenseExpiry: new Date(v.licenseExpiry) });
      toast.success(`${c.firstName} ${c.lastName} added as a driver`);
      onPick(c);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      if (!Object.keys(fe).length) toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {field("firstName", "First Name", { required: true })}
        {field("lastName", "Last Name", { required: true })}
        {field("phone", "Phone", { type: "tel" })}
        {field("licenseNumber", "Driver's Lic.#", { required: true })}
        {field("licenseExpiry", "Lic.Exp", { type: "date", required: true })}
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="nd-licenseProvince">Lic.State</Label>
          <NativeSelect id="nd-licenseProvince" value={v.licenseProvince} onChange={(e) => setV((s) => ({ ...s, licenseProvince: e.target.value }))}>
            <option value="" />
            {REGION_OPTIONS.map((r) => <option key={r}>{r}</option>)}
          </NativeSelect>
        </div>
        {field("birthDate", "Date of birth", { type: "date" })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Saved as a customer with these details, then added to this booking.</p>
        <Button type="button" size="sm" onClick={add} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add driver
        </Button>
      </div>
    </div>
  );
}
