import { publicApi } from "../_lib/api";
import { BookingWidget } from "../_components/booking-widget";
import { FleetBrowser } from "./fleet-browser";

export const metadata = {
  title: "Fleet | Mr Rent A Car",
  description:
    "Every vehicle class we rent across Vancouver & Calgary. Select your dates to check live rates.",
};

export default async function FleetPage() {
  const api = await publicApi();
  const locations = await api.locations();

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-stone-900">
      {/* ── MODERN AUTOMOTIVE HERO HEADER ───────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#242323] text-white">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-[#9D302D]/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-[#B15957] uppercase">
              Mr. Rent A Car Fleet
            </span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Our Vehicle Fleet
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">
              Every class we rent, by location. Clean, reliable, fully-inspected vehicles across Vancouver and Calgary. Prices depend on your dates — search to see live rates.
            </p>
          </div>
        </div>
      </section>

      {/* ── MAIN FLEET BROWSER + STICKY BOOKING PANEL ─────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          {/* Main Fleet Catalog */}
          <div>
            <FleetBrowser locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
          </div>

          {/* Sticky Booking Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
              <h2 className="mb-3 text-base font-bold text-stone-900">Check prices</h2>
              <BookingWidget variant="panel" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
