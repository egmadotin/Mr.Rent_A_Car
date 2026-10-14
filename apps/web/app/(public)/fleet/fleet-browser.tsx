"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { cn } from "@mrac/ui/lib/utils";
import { VehicleClassCard } from "../_components/vehicle-class-card";

/** Location chooser + seats / bags / doors filters, like the current Fleet page. */
export function FleetBrowser({ locations }: { locations: { id: string; name: string }[] }) {
  const trpc = useTRPC();
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? "");
  const [seats, setSeats] = React.useState<number | null>(null);
  const [bags, setBags] = React.useState<number | null>(null);
  const { data, isLoading } = useQuery(trpc.customer.fleet.queryOptions({ locationId: locationId || undefined }));

  const all = data ?? [];
  const seatOpts = [...new Set(all.map((v) => v.seats).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const bagOpts = [...new Set(all.map((v) => v.luggage).filter((x): x is number => x != null && x > 0))].sort((a, b) => a - b);
  const shown = all.filter((v) => (seats == null || (v.seats ?? 0) >= seats) && (bags == null || (v.luggage ?? 0) >= bags));

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("rounded-full border px-3 py-1 text-sm", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
      {children}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs space-y-1.5">
          <Label htmlFor="fleet-loc">Choose location</Label>
          <NativeSelect id="fleet-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </div>
        {seatOpts.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Seats</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={seats == null} onClick={() => setSeats(null)}>Any</Chip>
              {seatOpts.map((n) => <Chip key={n} active={seats === n} onClick={() => setSeats(n)}>{n}+</Chip>)}
            </div>
          </div>
        )}
        {bagOpts.length > 1 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Bags</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={bags == null} onClick={() => setBags(null)}>Any</Chip>
              {bagOpts.map((n) => <Chip key={n} active={bags === n} onClick={() => setBags(n)}>{n}+</Chip>)}
            </div>
          </div>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading fleet…</p>}
      {!isLoading && shown.length === 0 && <p className="text-muted-foreground">No classes match at this location.</p>}
      <div className="grid gap-4">
        {shown.map((vc) => <VehicleClassCard key={vc.id} vc={vc} />)}
      </div>
    </div>
  );
}
