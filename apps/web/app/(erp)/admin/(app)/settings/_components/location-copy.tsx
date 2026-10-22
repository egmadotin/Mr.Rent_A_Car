"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Copy Location Setup (LocationsCopy.aspx): Copy From Source Location, Copy From Date, To Destination Location(s),
 * Information to copy. Only what the destination doesn't have yet is copied.
 */
const ITEMS = [
  ["insurances", "Insurances"], ["miscCharges", "Miscellaneous Charges"], ["taxes", "Taxes"], ["rates", "Rates"],
  ["paymentMethods", "Payment Methods"], ["rentalForms", "Rental Forms"], ["vehicleTypes", "Vehicle Types"], ["hours", "Hours Of Operation"],
] as const;
type Item = (typeof ITEMS)[number][0];
const SHARED = ["Damages Locations", "Referrals", "Reasons", "Regions", "Rental Types", "Body", "Vehicle Makes", "Vehicle Options", "Vehicle Models", "Vehicle Status", "User Groups", "Seasons"];

export function LocationCopy() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const [fromId, setFromId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [toIds, setToIds] = React.useState<string[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [confirm, setConfirm] = React.useState(false);
  const toggle = <T,>(xs: T[], x: T, on: boolean) => (on ? [...xs, x] : xs.filter((y) => y !== x));
  const dests = locations.filter((l) => l.id !== fromId);

  async function go() {
    try {
      const counts = await client.staff.settings.locationCopy.mutate({ fromId, toIds, items, from: from ? new Date(`${from}T00:00`) : null });
      const summary = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");
      toast.success(summary ? `Copied: ${summary}` : "Nothing to copy — the destination already has all of it.");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-4xl">
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lc-from">Copy From Source Location</Label>
              <NativeSelect id="lc-from" value={fromId} onChange={(e) => { setFromId(e.target.value); setToIds((t) => t.filter((x) => x !== e.target.value)); }}>
                <option value="">Please select</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-date">Copy From Date</Label>
              <Input id="lc-date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <p className="text-xs text-muted-foreground">Rates that ended before this date are left out.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">To Destination Location(s)</legend>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={dests.length > 0 && toIds.length === dests.length} onChange={(e) => setToIds(e.target.checked ? dests.map((l) => l.id) : [])} /> Check All Boxes</label>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                {dests.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm"><Checkbox checked={toIds.includes(l.id)} onChange={(e) => setToIds((t) => toggle(t, l.id, e.target.checked))} /> {l.name}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Information to copy</legend>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={items.length === ITEMS.length} onChange={(e) => setItems(e.target.checked ? ITEMS.map(([k]) => k) : [])} /> Check All Boxes</label>
              <div className="space-y-1 rounded-md border p-2">
                {ITEMS.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={items.includes(k)} onChange={(e) => setItems((t) => toggle(t, k, e.target.checked))} /> {l}</label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Shared by every location already (nothing to copy): {SHARED.join(", ")}.</p>
            </fieldset>
          </div>
          <div className="flex justify-end">
            <Button disabled={!can("LocationsEdit") || !fromId || !toIds.length || !items.length} title={can("LocationsEdit") ? undefined : NO_PERMISSION} onClick={() => setConfirm(true)}>Go</Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Copy this setup?"
        description={`Copies ${items.length} kind(s) of setup to ${toIds.length} location(s). Items the destination already has (same name / code) are kept as they are.`}
        confirmLabel="Copy"
        onConfirm={go}
      />
    </div>
  );
}
