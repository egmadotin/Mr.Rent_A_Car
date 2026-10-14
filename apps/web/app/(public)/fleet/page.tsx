import { publicApi } from "../_lib/api";
import { BookingWidget } from "../_components/booking-widget";
import { FleetBrowser } from "./fleet-browser";

export const metadata = { title: "Fleet" };

export default async function FleetPage() {
  const api = await publicApi();
  const locations = await api.locations();
  return (
    <>
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold tracking-tight">Our fleet</h1>
          <p className="mt-2 opacity-80">Every class we rent, by location. Prices depend on your dates — search to see them.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <FleetBrowser locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="mb-3 text-lg font-semibold">Check prices</h2>
          <BookingWidget variant="panel" />
        </aside>
      </div>
    </>
  );
}
