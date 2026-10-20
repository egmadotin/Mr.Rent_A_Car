"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Rates > Setup (RatesSetup.aspx): #Days in Month, then the Rate Ratios (Daily : 1). */
export function RatesSetupForm() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.settings.rateSetupGet.queryOptions());
  const [saving, setSaving] = React.useState(false);
  if (!q.data) return null;
  const d = q.data;
  const editable = can("RatesEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const n = (k: string) => Number(fd.get(k));
    setSaving(true);
    try {
      await client.staff.settings.rateSetupSave.mutate({ daysInMonth: n("daysInMonth"), hourly: n("hourly"), extraDaily: n("extraDaily"), weekly: n("weekly"), monthly: n("monthly") });
      await qc.invalidateQueries({ queryKey: trpc.staff.settings.rateSetupGet.queryKey() });
      toast.success("Rates Setup saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-md">
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={!editable} className="space-y-4">
              <F label="#Days in Month" name="daysInMonth">
                <NativeSelect id="daysInMonth" name="daysInMonth" defaultValue={String(d.daysInMonth)}>{[27, 28, 29, 30, 31].map((x) => <option key={x}>{x}</option>)}</NativeSelect>
              </F>
              <p className="text-sm font-medium">Rate Ratios <span className="font-normal text-muted-foreground">(Daily : 1)</span></p>
              {([["hourly", "Hourly", d.hourly], ["extraDaily", "Extra Daily", d.extraDaily], ["weekly", "Weekly", d.weekly], ["monthly", "Monthly", d.monthly]] as const).map(([k, l, v]) => (
                <F key={k} label={l} name={k}><Input id={k} name={k} type="number" min={0} step="any" defaultValue={v} /></F>
              ))}
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
