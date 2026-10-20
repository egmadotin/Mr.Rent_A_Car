"use client";

/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import * as React from "react";
import { BriefcaseIcon, CarFrontIcon, DoorOpenIcon, UsersIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

export type DealClass = { id: string; name: string; description: string | null; seats: number | null; luggage: number | null; doors: number | null; imageKey?: string | null; fromDaily?: string | null };

/** Category tabs from the class names (RentCentric has no category field on the public classes). */
function categoryOf(name: string) {
  if (/scooter/i.test(name)) return "Scooter";
  if (/model 3|eqb|electric|\bev\b/i.test(name)) return "Electric";
  if (/van/i.test(name)) return "Minivan";
  if (/suv/i.test(name)) return "SUV";
  return "Car";
}
const ORDER = ["Car", "SUV", "Minivan", "Electric", "Scooter"];
const LABEL: Record<string, string> = { All: "All", Car: "Cars", SUV: "SUVs", Minivan: "Minivans", Electric: "Electric", Scooter: "Scooters" };

/** "Most Popular Car Deals": tabs + class cards with the lowest online daily price. */
export function CarDeals({ classes }: { classes: DealClass[] }) {
  const tabs = ["All", ...ORDER.filter((c) => classes.some((x) => categoryOf(x.name) === c))];
  const [tab, setTab] = React.useState("All");
  const shown = classes.filter((c) => tab === "All" || categoryOf(c.name) === tab).slice(0, 8);

  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="Vehicle category" className="flex flex-wrap justify-center gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "border-[#2D2C2C] bg-[#2D2C2C] text-white" : "border-[#D5D5D5] bg-white text-[#575656] hover:border-[#9D302D] hover:text-[#9D302D]",
            )}
          >
            {LABEL[t] ?? t}
          </button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((c) => (
          <article key={c.id} className="group flex flex-col rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_6px_24px_-12px_rgba(45,44,44,0.25)] transition-shadow hover:shadow-[0_18px_40px_-16px_rgba(157,48,45,0.35)]">
            <h3 className="font-semibold text-[#2D2C2C]">{c.name}</h3>
            {c.description && <p className="line-clamp-1 text-xs text-[#818080]">{c.description}</p>}
            <div className="my-3 grid aspect-[16/9] place-items-center">
              {c.imageKey ? (
                <img src={c.imageKey} alt={c.name} loading="lazy" className="max-h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <CarFrontIcon className="size-12 text-[#ABABAB]" aria-hidden />
              )}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#575656]">
              {c.seats != null && <li className="flex items-center gap-1"><UsersIcon className="size-3.5" /> {c.seats} People</li>}
              {c.luggage != null && <li className="flex items-center gap-1"><BriefcaseIcon className="size-3.5" /> {c.luggage} Bags</li>}
              {c.doors != null && <li className="flex items-center gap-1"><DoorOpenIcon className="size-3.5" /> {c.doors} Doors</li>}
            </ul>
            <div className="mt-4 flex items-end justify-between gap-2 border-t border-[#EAEAEA] pt-3">
              {c.fromDaily ? (
                <p className="text-[#2D2C2C]"><span className="text-xs text-[#818080]">From </span><span className="text-lg font-bold">${Number(c.fromDaily).toFixed(2)}</span><span className="text-xs text-[#818080]">/day</span></p>
              ) : (
                <p className="text-sm text-[#818080]">See prices</p>
              )}
              <a href="#book" className="rounded-md bg-[#9D302D] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#B15957]">Rent Now</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
