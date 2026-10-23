/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import Link from "next/link";
import { ArrowRightIcon, BadgeDollarSignIcon, CalendarRangeIcon, HomeIcon, KeyRoundIcon, PlaneIcon, ReceiptTextIcon } from "lucide-react";
import { BookingWidget } from "./_components/booking-widget";
import { CarDeals } from "./_components/home/car-deals";
import { ArrowLink, CATEGORY_ORDER, ClassTile, Container, Price, PromoBanner, SectionHeading, categoryOf, type Category } from "./_components/ds";
import { LocationCard } from "./_components/location-card";
import { resolveVehicleImage } from "./_lib/vehicle-images";
import { publicApi } from "./_lib/api";

const HERO_CAR = "/legacy/vehicle-types/vehicletypeid127dodge-charger-778x364.png";

const TRUST = [
  { icon: HomeIcon, title: "Locally owned since 1996", text: "Metro Vancouver and Calgary" },
  { icon: ReceiptTextIcon, title: "All-in prices", text: "Taxes and fees shown before you reserve" },
  { icon: PlaneIcon, title: "Airport pick-up", text: "At YVR and YYC" },
  { icon: KeyRoundIcon, title: "24-hour key drop", text: "Return when it suits you" },
];

export default async function HomePage() {
  const api = await publicApi();
  const [classes, brands, locations] = await Promise.all([api.fleet({}), api.brands(), api.locations()]);

  const priced = classes.map((c) => ({ ...c, image: resolveVehicleImage(c.name, c.imageKey), cat: categoryOf(c.name), from: "fromDaily" in c && c.fromDaily ? Number(c.fromDaily) : null }));
  const lowest = priced.reduce<number | null>((m, c) => (c.from != null && (m == null || c.from < m) ? c.from : m), null);

  // The price ladder: one tile per category, cheapest first and Signature last.
  const ladder = CATEGORY_ORDER.map((cat) => {
    const inCat = priced.filter((c) => c.cat === cat);
    if (!inCat.length) return null;
    const withPrice = inCat.filter((c) => c.from != null).sort((a, b) => a.from! - b.from!);
    const pick = withPrice[0] ?? inCat[0]!;
    return { cat, count: inCat.length, from: withPrice[0]?.from ?? null, image: pick.image };
  }).filter(Boolean) as { cat: Category; count: number; from: number | null; image: string }[];

  const signature = priced.filter((c) => c.cat === "Signature" && c.image).slice(0, 3);
  const heroCar = priced.find((c) => /charger|camry|civic/i.test(c.name))?.image ?? HERO_CAR;

  return (
    <>
      {/* ── Hero band + booking capsule ─────────────────────────────────── */}
      <section id="book" className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-sheet border bg-card">
          <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 size-[38rem] rounded-full bg-[radial-gradient(circle,var(--brand-glow)_0%,transparent_62%)] opacity-70" />
          <div className="relative grid items-center gap-6 px-6 pt-10 pb-28 sm:px-10 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-32">
            <div>
              <p className="text-[13px] font-semibold text-muted-foreground">Metro Vancouver · Calgary · since 1996</p>
              <h1 className="mt-3 type-hero text-balance">
                Car rental, <span className="text-brand">priced honestly.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[18px] leading-[1.55] text-muted-foreground">
                Locally owned and run. Economy to Signature, with the all-in price — taxes and fees included — shown before you reserve.
              </p>
              {lowest != null && (
                <div className="mt-7">
                  <Price amount={lowest} size="lg" from />
                </div>
              )}
            </div>
            <div className="relative -mx-4 sm:mx-0">
              <div aria-hidden className="absolute inset-x-6 bottom-2 h-10 rounded-[50%] bg-foreground/15 blur-2xl" />
              <img src={heroCar} alt="A car from the Mr. Rent A Car fleet" className="relative mx-auto w-full max-w-[640px] object-contain" />
            </div>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-20 max-w-[1180px] px-2 sm:px-6">
          <BookingWidget variant="bar" />
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <Container className="mt-12">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-card text-foreground ring-1 ring-border">
                <t.icon className="size-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>

      {/* ── Price ladder ────────────────────────────────────────────────── */}
      {ladder.length > 0 && (
        <Container className="mt-24">
          <SectionHeading
            kicker="Our fleet"
            title="Everyday to Signature, one honest price list"
            lead="“From” prices come from our live rates. Choose your dates to see the all-in total."
            action={<ArrowLink href="/fleet">See all vehicles</ArrowLink>}
          />
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {ladder.slice(0, 5).map((t) => (
              <ClassTile key={t.cat} category={t.cat} image={t.image} fromDaily={t.from} count={t.count} href={`/fleet?type=${encodeURIComponent(t.cat)}`} />
            ))}
          </div>
        </Container>
      )}

      {/* ── Popular vehicles ────────────────────────────────────────────── */}
      <Container className="mt-24">
        <SectionHeading kicker="Popular right now" title="Cars people book most" />
        <div className="mt-8">
          <CarDeals classes={classes} />
        </div>
      </Container>

      {/* ── Promo banners ───────────────────────────────────────────────── */}
      <Container className="mt-24">
        <div className="grid gap-4 md:grid-cols-3">
          <PromoBanner
            tone="green"
            icon={CalendarRangeIcon}
            title="Staying longer?"
            text="Weekly and monthly rates cost less per day. Choose your dates and they show up in your price."
            href="/fleet"
            cta="See weekly rates"
          />
          <PromoBanner
            tone="steel"
            icon={PlaneIcon}
            title="Flying into YVR or YYC"
            text="Off-airport pick-up from Vancouver and Calgary airports. The pick-up steps are in your confirmation."
            href="/our-locations"
            cta="Airport pick-up"
          />
          <PromoBanner
            icon={BadgeDollarSignIcon}
            title="Insurance replacement & corporate"
            text="A car while yours is in the shop, and accounts for local businesses."
            href="/contact-us"
            cta="Talk to us"
          />
        </div>
      </Container>

      {/* ── Signature band ──────────────────────────────────────────────── */}
      {signature.length > 0 && (
        <section className="mt-24 px-4 sm:px-6 lg:px-8">
          <div className="signature relative mx-auto max-w-[1280px] overflow-hidden rounded-sheet">
            <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 size-[36rem] rounded-full bg-[radial-gradient(circle,rgba(200,166,110,0.22)_0%,transparent_62%)]" />
            <div className="relative grid gap-10 px-6 py-14 sm:px-10 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-[13px] font-semibold text-champagne">The Signature fleet</p>
                <h2 className="mt-3 type-signature-display text-balance">Arrive in something special.</h2>
                <p className="mt-5 max-w-md text-[17px] leading-relaxed text-on-onyx-muted">
                  Premium SUVs, sport sedans and convertibles — the same honest pricing, a different mood.
                </p>
                <Link
                  href="/fleet?type=Signature"
                  className="group mt-8 inline-flex h-12 items-center gap-2 rounded-pill bg-champagne px-6 text-[15px] font-semibold text-on-champagne transition-colors hover:bg-champagne-light"
                >
                  See the Signature fleet <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-[3px]" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {signature.map((c, i) => (
                  <div key={c.id} className={i === 0 ? "studio col-span-2 grid aspect-[16/8] place-items-center rounded-card border border-onyx-line p-4" : "studio grid aspect-[16/10] place-items-center rounded-card border border-onyx-line p-3"}>
                    <img src={c.image} alt={c.name} loading="lazy" className="max-h-full w-full object-contain" />
                    <span className="sr-only">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Locations ───────────────────────────────────────────────────── */}
      {locations.length > 0 && (
        <Container className="mt-24">
          <SectionHeading
            kicker="Locations"
            title="Pick up close to where you are"
            lead="Real hours, addresses and phone numbers for every branch. Returning somewhere else? Turn it on in the booking bar."
            action={<ArrowLink href="/our-locations">All locations</ArrowLink>}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.slice(0, 6).map((l) => (
              <LocationCard key={l.id} l={l} />
            ))}
          </div>
        </Container>
      )}

      {/* ── Makes in the fleet ──────────────────────────────────────────── */}
      {brands.length > 0 && (
        <Container className="mt-24">
          <div className="flex flex-col gap-5 rounded-card border bg-card p-6 md:flex-row md:items-center md:gap-10">
            <p className="shrink-0 text-[15px] font-semibold">Makes in our fleet</p>
            <ul className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <li key={b} className="rounded-pill bg-muted px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      )}
    </>
  );
}
