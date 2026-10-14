import { ClockIcon, KeyRoundIcon, MailIcon, MapPinIcon, PhoneIcon, PrinterIcon } from "lucide-react";
import { publicApi } from "../_lib/api";
import { hoursLines } from "../_lib/hours";

export const metadata = { title: "Our Locations" };

export default async function LocationsPage() {
  const locations = await (await publicApi()).locations();
  return (
    <>
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold tracking-tight">Our locations</h1>
          <p className="mt-2 opacity-80">Car rental locations, hours and contact details.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((l) => (
          <article key={l.id} className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-bold">{l.name}</h2>
            <ul className="space-y-2 text-sm">
              {(l.address1 || l.city) && (
                <li className="flex gap-2"><MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" />{[l.address1, l.city, l.province, l.postal].filter(Boolean).join(", ")}</li>
              )}
              {l.phone && <li className="flex gap-2"><PhoneIcon className="mt-0.5 size-4 shrink-0 text-primary" /><a className="hover:underline" href={`tel:${l.phone}`}>{l.phone}</a></li>}
              {l.fax && <li className="flex gap-2"><PrinterIcon className="mt-0.5 size-4 shrink-0 text-primary" />Fax {l.fax}</li>}
              {l.email && <li className="flex gap-2"><MailIcon className="mt-0.5 size-4 shrink-0 text-primary" /><a className="hover:underline" href={`mailto:${l.email}`}>{l.email}</a></li>}
            </ul>
            {l.hours.length > 0 && (
              <div className="space-y-1 text-sm">
                <h3 className="flex items-center gap-2 font-semibold"><ClockIcon className="size-4 text-primary" /> Office hours</h3>
                {l.hoursNote && <p className="flex items-center gap-2 text-muted-foreground"><KeyRoundIcon className="size-3.5" /> {l.hoursNote}</p>}
                <ul className="text-muted-foreground">{hoursLines(l.hours).map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
