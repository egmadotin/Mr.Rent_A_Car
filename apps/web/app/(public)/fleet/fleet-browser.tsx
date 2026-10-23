"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseIcon,
  DoorOpenIcon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { cn } from "@mrac/ui/lib/utils";
import { resolveVehicleImage } from "../_lib/vehicle-images";

export type LocationOption = { id: string; name: string };

type VehicleClassItem = {
  id: string;
  name: string;
  description: string | null;
  seats: number | null;
  luggage: number | null;
  doors: number | null;
  imageKey?: string | null;
  fromDaily?: string | null;
};

/** Categorization from vehicle class name */
const kindOf = (name: string) =>
  /suv|sport utility/i.test(name)
    ? "SUV"
    : /minivan|passenger/i.test(name)
      ? "Minivan"
      : /\bvan\b|cargo/i.test(name)
        ? "Van"
        : /truck|pickup/i.test(name)
          ? "Truck"
          : "Car";

const KINDS = ["Car", "SUV", "Minivan", "Van", "Truck"];

export function FleetBrowser({ locations }: { locations: LocationOption[] }) {
  const trpc = useTRPC();

  // Location filter: default to "" (All Locations) so full fleet displays initially
  const [locationId, setLocationId] = React.useState<string>("");
  const [seats, setSeats] = React.useState<number | null>(null);
  const [bags, setBags] = React.useState<number | null>(null);
  const [doors, setDoors] = React.useState<number | null>(null);
  const [kind, setKind] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery(
    trpc.customer.fleet.queryOptions({ locationId: locationId || undefined }),
  );

  const all: VehicleClassItem[] = (data as VehicleClassItem[]) ?? [];

  const seatOpts = [...new Set(all.map((v) => v.seats).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const bagOpts = [...new Set(all.map((v) => v.luggage).filter((x): x is number => x != null && x > 0))].sort((a, b) => a - b);
  const doorOpts = [...new Set(all.map((v) => v.doors).filter((x): x is number => x != null && x > 0))].sort((a, b) => a - b);
  const kindOpts = KINDS.filter((k) => all.some((v) => kindOf(v.name) === k));

  const shown = all.filter(
    (v) =>
      (seats == null || (v.seats ?? 0) >= seats) &&
      (bags == null || (v.luggage ?? 0) >= bags) &&
      (doors == null || v.doors === doors) &&
      (kind == null || kindOf(v.name) === kind),
  );

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
        active
          ? "bg-[#9D302D] text-white shadow-xs"
          : "bg-stone-100 text-stone-700 hover:bg-stone-200",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ── FILTER CONTROLS ────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        {/* Location selector */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="fleet-loc" className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-stone-600 uppercase">
            <MapPinIcon className="size-4 text-[#9D302D]" />
            Location:
          </label>
          <div className="min-w-[260px] flex-1 max-w-md">
            <select
              id="fleet-loc"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-stone-50/80 px-3.5 py-2 text-sm font-semibold text-stone-900 transition-colors focus:border-[#9D302D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9D302D]/15"
            >
              <option value="">All Locations (Full Fleet)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {locationId && (
            <button
              type="button"
              onClick={() => setLocationId("")}
              className="text-xs font-medium text-[#9D302D] underline underline-offset-4 hover:text-[#782422]"
            >
              Show All Locations
            </button>
          )}
        </div>

        {/* Vehicle Type Pills */}
        {kindOpts.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <span className="text-xs font-bold text-stone-600 uppercase tracking-wider mr-1">Type:</span>
            <Chip active={kind == null} onClick={() => setKind(null)}>
              All
            </Chip>
            {kindOpts.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {k}
              </Chip>
            ))}
          </div>
        )}

        {/* Spec Filters: Seats, Bags, Doors */}
        <div className="flex flex-wrap items-center gap-4 border-t border-stone-100 pt-3 text-xs">
          {seatOpts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-600">Seats:</span>
              <Chip active={seats == null} onClick={() => setSeats(null)}>
                Any
              </Chip>
              {seatOpts.map((n) => (
                <Chip key={n} active={seats === n} onClick={() => setSeats(n)}>
                  {n}+
                </Chip>
              ))}
            </div>
          )}

          {bagOpts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-600">Bags:</span>
              <Chip active={bags == null} onClick={() => setBags(null)}>
                Any
              </Chip>
              {bagOpts.map((n) => (
                <Chip key={n} active={bags === n} onClick={() => setBags(n)}>
                  {n}+
                </Chip>
              ))}
            </div>
          )}

          {doorOpts.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-stone-600">Doors:</span>
              <Chip active={doors == null} onClick={() => setDoors(null)}>
                Any
              </Chip>
              {doorOpts.map((n) => (
                <Chip key={n} active={doors === n} onClick={() => setDoors(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── LOADING & EMPTY STATES ─────────────────────────────────────── */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl border border-stone-200 bg-stone-100" />
          ))}
        </div>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-10 text-center">
          <p className="font-semibold text-stone-700">No classes match at this location with active filters.</p>
          {locationId && (
            <button
              type="button"
              onClick={() => {
                setLocationId("");
                setKind(null);
                setSeats(null);
                setBags(null);
                setDoors(null);
              }}
              className="mt-3 inline-block rounded-xl bg-[#9D302D] px-4 py-2 text-xs font-bold text-white hover:bg-[#782422]"
            >
              View Full Fleet (All Locations)
            </button>
          )}
        </div>
      )}

      {/* ── VEHICLE CLASS CARDS ────────────────────────────────────────── */}
      {!isLoading && shown.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {shown.map((vc) => {
            const resolvedImg = resolveVehicleImage(vc.name, vc.imageKey);
            const specs = [
              vc.seats != null && { icon: UsersIcon, label: `${vc.seats} seats` },
              vc.luggage != null && { icon: BriefcaseIcon, label: `${vc.luggage} bags` },
              vc.doors != null && { icon: DoorOpenIcon, label: `${vc.doors} doors` },
            ].filter(Boolean) as { icon: typeof UsersIcon; label: string }[];

            return (
              <article
                key={vc.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition-all duration-300 hover:border-[#9D302D]/30 hover:shadow-md"
              >
                {/* Photo Stage */}
                <div className="relative flex h-48 w-full items-center justify-center bg-stone-50/80 p-4">
                  <img
                    src={resolvedImg}
                    alt={vc.name}
                    loading="lazy"
                    className="max-h-36 max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-stone-900 group-hover:text-[#9D302D] transition-colors">
                        {vc.name}
                      </h3>
                      {vc.fromDaily && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-stone-400 block leading-none">From</span>
                          <span className="text-base font-extrabold text-[#9D302D]">
                            ${vc.fromDaily}
                            <span className="text-[11px] font-normal text-stone-500">/day</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {vc.description && (
                      <p className="text-xs text-stone-500 line-clamp-2">
                        {vc.description}
                      </p>
                    )}

                    {/* Real Specs: seats, luggage, doors */}
                    {specs.length > 0 && (
                      <ul className="flex flex-wrap gap-2 pt-2 text-xs">
                        {specs.map((s) => (
                          <li
                            key={s.label}
                            className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-700"
                          >
                            <s.icon className="size-3.5 text-[#9D302D]" />
                            {s.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
