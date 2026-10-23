"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, MapPinIcon, SearchXIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { cn } from "@mrac/ui/lib/utils";
import { CATEGORY_ORDER, Price, VehicleCard, categoryOf, type CardClass, type Category } from "../_components/ds";
import { resolveVehicleImage } from "../_lib/vehicle-images";

export type LocationOption = { id: string; name: string };

/** Fleet catalogue: location, category and seat filters over the class cards. */
export function FleetBrowser({ locations, initialType }: { locations: LocationOption[]; initialType?: string }) {
  const trpc = useTRPC();
  const [locationId, setLocationId] = React.useState<string>("");
  const [kind, setKind] = React.useState<Category | null>(CATEGORY_ORDER.includes(initialType as Category) ? (initialType as Category) : null);
  const [seats, setSeats] = React.useState<number | null>(null);
  const [bags, setBags] = React.useState<number | null>(null);

  const { data, isLoading } = useQuery(trpc.customer.fleet.queryOptions({ locationId: locationId || undefined }));
  const all: (CardClass & { fromDaily?: string | null })[] = (data as (CardClass & { fromDaily?: string | null })[]) ?? [];

  const seatOpts = [...new Set(all.map((v) => v.seats).filter((x): x is number => x != null && x > 0))].sort((a, b) => a - b);
  const bagOpts = [...new Set(all.map((v) => v.luggage).filter((x): x is number => x != null && x > 0))].sort((a, b) => a - b);
  const kindOpts = CATEGORY_ORDER.filter((k) => all.some((v) => categoryOf(v.name) === k));

  const shown = all
    .filter(
      (v) =>
        (seats == null || (v.seats ?? 0) >= seats) &&
        (bags == null || (v.luggage ?? 0) >= bags) &&
        (kind == null || categoryOf(v.name) === kind),
    )
    .sort((a, b) => CATEGORY_ORDER.indexOf(categoryOf(a.name)) - CATEGORY_ORDER.indexOf(categoryOf(b.name)));

  const reset = () => {
    setLocationId("");
    setKind(null);
    setSeats(null);
    setBags(null);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-4 rounded-card border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="fleet-loc" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <MapPinIcon className="size-4" /> Location
          </label>
          <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
            <select
              id="fleet-loc"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-11 w-full cursor-pointer appearance-none rounded-control border border-input bg-card px-3 text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${shown.length} of ${all.length} classes`}
          </span>
        </div>

        {kindOpts.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip active={kind == null} onClick={() => setKind(null)}>All</Chip>
            {kindOpts.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)} signature={k === "Signature"}>
                {k}
              </Chip>
            ))}
          </div>
        )}

        {(seatOpts.length > 1 || bagOpts.length > 1) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-4 text-sm">
            {seatOpts.length > 1 && (
              <Group label="Seats">
                <Chip small active={seats == null} onClick={() => setSeats(null)}>Any</Chip>
                {seatOpts.map((n) => (
                  <Chip small key={n} active={seats === n} onClick={() => setSeats(n)}>{n}+</Chip>
                ))}
              </Group>
            )}
            {bagOpts.length > 1 && (
              <Group label="Bags">
                <Chip small active={bags == null} onClick={() => setBags(null)}>Any</Chip>
                {bagOpts.map((n) => (
                  <Chip small key={n} active={bags === n} onClick={() => setBags(n)}>{n}+</Chip>
                ))}
              </Group>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-card border bg-card" />
          ))}
        </div>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="grid place-items-center gap-3 rounded-card border border-dashed bg-card px-6 py-14 text-center">
          <SearchXIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-semibold">No classes match these filters.</p>
          <button type="button" onClick={reset} className="h-10 rounded-control border px-4 text-sm font-semibold hover:bg-muted">
            Clear filters
          </button>
        </div>
      )}

      {!isLoading && shown.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((vc) => (
            <VehicleCard
              key={vc.id}
              vc={vc}
              image={resolveVehicleImage(vc.name, vc.imageKey)}
              footer={
                <>
                  {vc.fromDaily ? <Price amount={vc.fromDaily} from /> : <span className="text-sm text-muted-foreground">Price with your dates</span>}
                  <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("bw-pickup")?.focus(); }} className="text-[13px] font-semibold underline-offset-4 hover:underline">
                    Check dates
                  </a>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[13px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  small,
  signature,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
  signature?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-pill border font-semibold transition-colors",
        small ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
        active
          ? signature
            ? "border-onyx bg-onyx text-champagne"
            : "border-foreground bg-foreground text-background"
          : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
