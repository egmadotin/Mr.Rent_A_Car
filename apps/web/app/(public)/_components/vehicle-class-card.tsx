/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import { CarFrontIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";
import { Specs, categoryOf } from "./ds";
import { resolveVehicleImage } from "../_lib/vehicle-images";

export type VehicleClass = { id: string; name: string; description: string | null; seats: number | null; luggage: number | null; doors: number | null; imageKey?: string | null };

/**
 * One vehicle class as a wide row: studio photo, class name, "… or similar", icon specs; the price and action
 * (children) on the right. Used by the booking results.
 */
export function VehicleClassCard({ vc, children, className }: { vc: VehicleClass; children?: React.ReactNode; className?: string }) {
  const image = resolveVehicleImage(vc.name, vc.imageKey);
  const sig = categoryOf(vc.name) === "Signature";

  return (
    <article
      className={cn(
        "group grid overflow-hidden rounded-card border transition-shadow duration-180 hover:shadow-lift sm:grid-cols-[17rem_minmax(0,1fr)]",
        sig ? "signature border-onyx-line" : "bg-card",
        className,
      )}
    >
      <div className="studio relative grid aspect-[16/10] place-items-center p-4 sm:aspect-auto sm:min-h-44">
        {image ? (
          <img src={image} alt={vc.name} loading="lazy" className="max-h-40 w-full object-contain transition-transform duration-700 ease-out-quick group-hover:scale-[1.03]" />
        ) : (
          <CarFrontIcon className="size-14 text-muted-foreground/40" aria-hidden />
        )}
        {sig && <span className="absolute top-3 left-3 rounded-pill bg-champagne px-2.5 py-0.5 text-[11px] font-semibold text-on-champagne">Signature</span>}
      </div>
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:gap-6 md:p-6">
        <div className="min-w-0 space-y-2">
          <h3 className={cn("type-title-3", sig && "font-serif text-[26px] font-normal tracking-normal")}>{vc.name}</h3>
          {vc.description && <p className="text-sm text-muted-foreground">{vc.description}</p>}
          <Specs vc={vc} className="pt-1" />
        </div>
        {children && <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">{children}</div>}
      </div>
    </article>
  );
}
