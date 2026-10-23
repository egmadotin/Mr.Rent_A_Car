/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import { BriefcaseIcon, CarFrontIcon, DoorOpenIcon, UsersIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";

import { resolveVehicleImage } from "../_lib/vehicle-images";

export type VehicleClass = { id: string; name: string; description: string | null; seats: number | null; luggage: number | null; doors: number | null; imageKey?: string | null };

/** One vehicle class: picture slot, name, "… or similar", seats / luggage / doors. Shared by Fleet and booking results. */
export function VehicleClassCard({ vc, children, className }: { vc: VehicleClass; children?: React.ReactNode; className?: string }) {
  const specs = [
    vc.seats != null && { icon: UsersIcon, label: `${vc.seats} seats` },
    vc.luggage != null && { icon: BriefcaseIcon, label: `${vc.luggage} bags` },
    vc.doors != null && { icon: DoorOpenIcon, label: `${vc.doors} doors` },
  ].filter(Boolean) as { icon: typeof UsersIcon; label: string }[];

  const resolvedImage = resolveVehicleImage(vc.name, vc.imageKey);

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl border bg-card sm:flex-row", className)}>
      {/* Class photo */}
      <div className="grid aspect-[16/10] place-items-center bg-white sm:aspect-auto sm:w-56 sm:shrink-0 p-3">
        {resolvedImage ? (
          <img src={resolvedImage} alt={vc.name} loading="lazy" className="size-full object-contain" />
        ) : (
          <CarFrontIcon className="size-14 text-muted-foreground/50" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{vc.name}</h3>
          {vc.description && <p className="text-sm text-muted-foreground">{vc.description}</p>}
          {specs.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {specs.map((s) => (
                <li key={s.label} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-muted-foreground">
                  <s.icon className="size-3.5" /> {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {children && <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">{children}</div>}
      </div>
    </article>
  );
}
