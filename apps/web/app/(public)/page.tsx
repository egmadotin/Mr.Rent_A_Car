import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon, CarIcon, HeadphonesIcon, MapPinIcon, PiggyBankIcon, RepeatIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { BookingWidget } from "./_components/booking-widget";
import { VehicleClassCard } from "./_components/vehicle-class-card";
import { publicApi } from "./_lib/api";

/** The six service points from the current Our Services page. */
const SERVICES = [
  { icon: CarIcon, title: "Diverse vehicle selection" },
  { icon: HeadphonesIcon, title: "Customer service" },
  { icon: PiggyBankIcon, title: "Affordable rates" },
  { icon: CalendarCheckIcon, title: "Seamless online booking" },
  { icon: MapPinIcon, title: "Convenient locations" },
  { icon: RepeatIcon, title: "Flexible rental options" },
];

export default async function HomePage() {
  const api = await publicApi();
  const [classes, locations] = await Promise.all([api.fleet({}), api.locations()]);

  return (
    <>
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--primary),transparent_60%)] opacity-40" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1fr_28rem]">
          <div className="space-y-5">
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">Vancouver · Calgary</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-5xl">Car rentals that just work.</h1>
            <p className="max-w-lg text-lg opacity-85">Economy to luxury, minivans and SUVs — pick up at one of our locations and get on the road.</p>
          </div>
          <BookingWidget variant="hero" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Choose your car</h2>
            <p className="text-muted-foreground">A few of our most-booked classes.</p>
          </div>
          <Button variant="outline" asChild><Link href="/fleet">See the full fleet <ArrowRightIcon /></Link></Button>
        </div>
        <div className="grid gap-4">
          {classes.slice(0, 4).map((vc) => (
            <VehicleClassCard key={vc.id} vc={vc}>
              <Button asChild><Link href="/fleet">Reserve now</Link></Button>
            </VehicleClassCard>
          ))}
        </div>
      </section>

      <section className="bg-muted/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div key={s.title} className="flex items-center gap-3 rounded-xl bg-card p-5 shadow-xs">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground"><s.icon className="size-5" /></span>
              <span className="font-semibold">{s.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-14">
        <h2 className="text-3xl font-bold tracking-tight">Our locations</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {locations.map((l) => (
            <li key={l.id} className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold">{l.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{[l.address1, l.city, l.province].filter(Boolean).join(", ") || "Address on request"}</p>
              {l.phone && <a href={`tel:${l.phone}`} className="mt-2 block text-sm font-medium text-primary hover:underline">{l.phone}</a>}
            </li>
          ))}
        </ul>
        <Button variant="link" asChild className="px-0"><Link href="/our-locations">Hours and directions <ArrowRightIcon /></Link></Button>
      </section>
    </>
  );
}
