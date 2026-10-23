import { ArrowUpRightIcon, BuildingIcon, ClockIcon, KeyRoundIcon, MailIcon, MapPinIcon, PhoneIcon, PlaneIcon } from "lucide-react";
import { cn } from "@mrac/ui/lib/utils";
import { hoursLines } from "../_lib/hours";

export type PublicLocation = {
  id: string;
  name: string;
  isOffsite?: boolean | null;
  address1: string | null;
  city: string | null;
  province: string | null;
  postal: string | null;
  phone: string | null;
  fax?: string | null;
  email: string | null;
  hoursNote: string | null;
  hours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[];
};

const isAirport = (name: string) => /airport|\byvr\b|\byyc\b/i.test(name);

/** Airport code shown as the location code (Geist Mono, the only uppercase text). */
const codeOf = (name: string) => name.match(/\b(YVR|YYC)\b/i)?.[1]?.toUpperCase();

/** Location card: icon tile, name, one-line address + city line, hours, phone, directions. */
export function LocationCard({ l, detailed = false, className }: { l: PublicLocation; detailed?: boolean; className?: string }) {
  const Icon = isAirport(l.name) ? PlaneIcon : l.isOffsite ? BuildingIcon : MapPinIcon;
  const code = codeOf(l.name);
  const street = l.address1;
  const cityLine = [l.city, l.province, l.postal].filter(Boolean).join(", ");
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(["Mr. Rent A Car", l.address1, l.city, l.province].filter(Boolean).join(", "))}`;
  const lines = hoursLines(l.hours);

  return (
    <article className={cn("flex flex-col gap-4 rounded-card border bg-card p-5 transition-shadow duration-180 hover:shadow-lift", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-muted text-foreground">
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-heading">{l.name}</h3>
            {code && <span className="type-code rounded-[6px] bg-muted px-1.5 py-0.5 text-muted-foreground">{code}</span>}
          </div>
          {(street || cityLine) && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {street}
              {street && cityLine && <br />}
              {cityLine}
            </p>
          )}
        </div>
      </div>

      {lines.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ClockIcon className="size-4 text-muted-foreground" /> Hours
          </p>
          <ul className="text-muted-foreground">
            {lines.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          {l.hoursNote && (
            <p className="flex items-center gap-2 pt-1 text-muted-foreground">
              <KeyRoundIcon className="size-3.5" /> {l.hoursNote}
            </p>
          )}
        </div>
      )}

      {detailed && l.email && (
        <a href={`mailto:${l.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <MailIcon className="size-4" /> {l.email}
        </a>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        {l.phone && (
          <a href={`tel:${l.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] font-semibold hover:bg-muted">
            <PhoneIcon className="size-3.5" /> {l.phone}
          </a>
        )}
        <a href={maps} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1 rounded-pill px-3 text-[13px] font-semibold hover:bg-muted">
          Get directions <ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>
    </article>
  );
}
