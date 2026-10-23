"use client";

import * as React from "react";
import { cn } from "@mrac/ui/lib/utils";
import { CATEGORY_ORDER, Price, VehicleCard, categoryOf, type CardClass } from "../ds";
import { resolveVehicleImage } from "../../_lib/vehicle-images";

export type DealClass = CardClass & { fromDaily?: string | null };

/** "Cars people book most": category chips + vehicle cards with the lowest online daily price. */
export function CarDeals({ classes }: { classes: DealClass[] }) {
  const cats = CATEGORY_ORDER.filter((c) => classes.some((x) => categoryOf(x.name) === c));
  const tabs = ["All", ...cats];
  const [tab, setTab] = React.useState("All");
  const shown = classes.filter((c) => tab === "All" || categoryOf(c.name) === tab).slice(0, 8);

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Vehicle category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-9 shrink-0 rounded-pill border px-4 text-sm font-semibold transition-colors",
              tab === t ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((c) => (
          <VehicleCard
            key={c.id}
            vc={c}
            image={resolveVehicleImage(c.name, c.imageKey)}
            footer={
              <>
                {c.fromDaily ? <Price amount={c.fromDaily} from /> : <span className="text-sm text-muted-foreground">Price with your dates</span>}
                <a
                  href="#book"
                  className="inline-flex h-9 shrink-0 items-center rounded-control border px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors hover:border-foreground/30 hover:bg-muted"
                >
                  Check dates
                </a>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}
