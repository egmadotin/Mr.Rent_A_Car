"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { ACQUISITION_TYPES, CONDITION_COMPONENTS, CONDITION_RATINGS, OWNERSHIP_FIELDS, SOLD_METHODS } from "@mrac/api/vehicle-ownership-fields";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Ownership Information (VehicleLeaseInfo.aspx): every field in RentCentric's order, saved with "Save". */
export function OwnershipPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.vehicleRecords.ownershipGet.queryOptions({ vehicleId }));
  const companies = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.companies ?? [];
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = React.useState(false);
  if (q.isLoading) return null;
  const row = (q.data ?? {}) as Record<string, unknown>;
  const editable = can("VehiclesEdit");

  const initial = (k: string, kind: string) => {
    const v = row[k];
    if (v == null) return "";
    if (kind === "date") return new Date(v as string).toISOString().slice(0, 10);
    return String(v);
  };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(OWNERSHIP_FIELDS.map(([k, , kind]) => [k, kind === "bool" ? fd.get(k) === "on" : String(fd.get(k) ?? "")]));
    setSaving(true);
    setErrors({});
    try {
      await client.staff.vehicleRecords.ownershipSave.mutate({ vehicleId, data } as never);
      await qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.ownershipGet.queryKey({ vehicleId }) });
      toast.success("Ownership Information saved");
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(fieldErrorsOf(err)).map(([k, v]) => [k.replace(/^data\./, ""), v])));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">Ownership Information</CardTitle></CardHeader>
      <CardContent className="px-4">
        <FormErrorsContext.Provider value={errors}>
          <form onSubmit={save} noValidate>
            <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {OWNERSHIP_FIELDS.map(([k, label, kind]) => {
                const dv = initial(k, kind);
                let input: React.ReactNode;
                if (kind === "bool") input = <label className="flex h-9 items-center gap-2 text-sm"><Checkbox id={k} name={k} defaultChecked={row[k] === true} /> Yes</label>;
                else if (kind === "long") input = <Textarea id={k} name={k} rows={2} defaultValue={dv} />;
                else if (kind === "acq" || kind === "sold" || kind === "state" || kind === "company") {
                  const opts = kind === "acq" ? ACQUISITION_TYPES.map((x) => [x, x]) : kind === "sold" ? SOLD_METHODS.map((x) => [x, x]) : kind === "state" ? REGION_OPTIONS.map((x) => [x, x]) : companies.map((c) => [c.id, c.name]);
                  input = (
                    <NativeSelect id={k} name={k} defaultValue={dv}>
                      <option value="">{kind === "company" ? "None" : ""}</option>
                      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </NativeSelect>
                  );
                } else input = <Input id={k} name={k} type={kind === "date" ? "date" : kind === "text" ? "text" : "number"} step={kind === "money" ? "0.01" : kind === "num" ? "any" : undefined} defaultValue={dv} />;
                return <F key={k} label={label} name={k} className={kind === "long" ? "sm:col-span-2" : undefined}>{input}</F>;
              })}
            </fieldset>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </FormErrorsContext.Provider>
      </CardContent>
    </Card>
  );
}

/** Vehicle Condition (VehicleConditions.aspx): Component/Condition grid of ticks, then Special Comment 1-4. */
export function ConditionPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.vehicleRecords.conditionGet.queryOptions({ vehicleId }));
  const [saving, setSaving] = React.useState(false);
  if (q.isLoading) return null;
  const ratings = (q.data?.ratings ?? {}) as Record<string, string[]>;
  const editable = can("VehiclesEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const r = Object.fromEntries(CONDITION_COMPONENTS.map((c) => [c, CONDITION_RATINGS.map(([k]) => k).filter((k) => fd.get(`${c}|${k}`) === "on")]));
    setSaving(true);
    try {
      await client.staff.vehicleRecords.conditionSave.mutate({
        vehicleId, ratings: r as never,
        comment1: String(fd.get("comment1") ?? ""), comment2: String(fd.get("comment2") ?? ""), comment3: String(fd.get("comment3") ?? ""), comment4: String(fd.get("comment4") ?? ""),
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.conditionGet.queryKey({ vehicleId }) });
      toast.success("Vehicle Condition saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">Vehicle Condition</CardTitle></CardHeader>
      <CardContent className="px-4">
        <form onSubmit={save}>
          <fieldset disabled={!editable} className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr><th className="px-2 py-1.5 text-left font-medium">Component/Condition</th>{CONDITION_RATINGS.map(([k, l]) => <th key={k} className="px-2 py-1.5 font-medium">{l}</th>)}</tr>
                </thead>
                <tbody>
                  {CONDITION_COMPONENTS.map((c) => (
                    <tr key={c} className="border-t">
                      <td className="px-2 py-1">{c}</td>
                      {CONDITION_RATINGS.map(([k, l]) => (
                        <td key={k} className="px-2 py-1 text-center"><Checkbox name={`${c}|${k}`} aria-label={`${c}: ${l}`} defaultChecked={ratings[c]?.includes(k)} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([1, 2, 3, 4] as const).map((n) => (
                <F key={n} label={`Special Comment ${n}`} name={`comment${n}`}><Textarea id={`comment${n}`} name={`comment${n}`} rows={2} defaultValue={q.data?.[`comment${n}`] ?? ""} /></F>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
