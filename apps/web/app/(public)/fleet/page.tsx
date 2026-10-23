import { publicApi } from "../_lib/api";
import { BookingWidget } from "../_components/booking-widget";
import { PageHero } from "../_components/ds";
import { FleetBrowser } from "./fleet-browser";

export const metadata = {
  title: "Fleet",
  description: "Every vehicle class we rent across Vancouver and Calgary, economy to Signature. Choose your dates to see live, all-in prices.",
};

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, locations] = await Promise.all([searchParams, (await publicApi()).locations()]);

  return (
    <>
      <PageHero
        kicker="Our fleet"
        title="Every car we rent, economy to Signature"
        lead="Classes are shown as “or similar” — you get that class, the model may vary. Choose your dates to see live, all-in prices."
      />
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <FleetBrowser locations={locations.map((l) => ({ id: l.id, name: l.name }))} initialType={type} />
        <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
          <h2 className="type-heading">Check prices for your dates</h2>
          <BookingWidget variant="panel" />
        </aside>
      </div>
    </>
  );
}
