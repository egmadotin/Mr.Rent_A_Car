/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon, CarIcon, HeadphonesIcon, MapPinIcon, PiggyBankIcon, RepeatIcon } from "lucide-react";
import { BookingWidget } from "./_components/booking-widget";
import { CarDeals } from "./_components/home/car-deals";
import { publicApi } from "./_lib/api";

/** Home page laid out like the client's reference design, in the design.md palette (Terra Red / warm canvas / Carbon). */

const HERO_CAR = "/legacy/vehicle-types/vehicletypeid127dodge-charger-778x364.png";

/** The six service points from the current Our Services page, three each side of the car. */
const BENEFITS = [
  { icon: CarIcon, title: "Wide range of vehicles", text: "From economy to luxury, minivans and SUVs — choose the right car for any trip." },
  { icon: HeadphonesIcon, title: "Customer service", text: "Real people at the counter and on the phone to help before and during your rental." },
  { icon: PiggyBankIcon, title: "Affordable rates", text: "Clear daily, weekly and monthly prices, shown before you book." },
  { icon: CalendarCheckIcon, title: "Seamless online booking", text: "Reserve online in three steps, any time of day." },
  { icon: MapPinIcon, title: "Convenient locations", text: "Pick up across the Lower Mainland and at Calgary airport." },
  { icon: RepeatIcon, title: "Flexible rental options", text: "Short trips or long stays — rent for as long as you need." },
];

const pill = "mx-auto w-fit rounded-md bg-[#F6EBEA] px-3 py-1 text-xs font-semibold tracking-wide text-[#9D302D]";
const heading = "mt-3 text-center font-serif text-3xl leading-tight font-bold text-[#2D2C2C] text-balance md:text-4xl";

function Benefit({ b, align }: { b: (typeof BENEFITS)[number]; align: "left" | "right" }) {
  return (
    <li className={`flex gap-4 ${align === "left" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#F6EBEA] text-[#9D302D]"><b.icon className="size-5" /></span>
      <div>
        <h3 className="font-semibold text-[#2D2C2C]">{b.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#818080]">{b.text}</p>
      </div>
    </li>
  );
}

export default async function HomePage() {
  const api = await publicApi();
  const [classes, brands] = await Promise.all([api.fleet({}), api.brands()]);
  const sideCar = classes.find((c) => /suv/i.test(c.name) && c.imageKey)?.imageKey ?? HERO_CAR;

  return (
    <div className="bg-white text-[#2D2C2C]">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section id="book" className="relative overflow-hidden bg-gradient-to-b from-[#F4F0E8] to-white pt-12">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="font-serif text-2xl font-bold md:text-3xl">Find Your Ride &amp; Rent in Minutes</p>
          <div className="relative mt-2">
            <p
              aria-hidden
              className="pointer-events-none font-serif text-[18vw] leading-none font-bold tracking-tight text-[#9D302D] select-none md:text-[9.5rem]"
            >
              Rental cars
            </p>
            <img
              src={HERO_CAR}
              alt="A rental car from the Mr Rent A Car fleet"
              className="relative z-10 mx-auto -mt-[9vw] w-full max-w-3xl drop-shadow-[0_25px_35px_rgba(45,44,44,0.22)] md:-mt-24"
            />
          </div>
        </div>
        <div className="relative mx-auto -mt-2 max-w-5xl px-4 pb-14">
          <BookingWidget variant="bar" />
        </div>
      </section>

      {/* ── Why choose us ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className={pill}>Why Choose Us</p>
        <h2 className={heading}>We ensure a smooth journey<br className="hidden md:block" /> with unbeatable rental benefits</h2>
        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_22rem_1fr]">
          <ul className="space-y-10">{BENEFITS.slice(0, 3).map((b) => <Benefit key={b.title} b={b} align="left" />)}</ul>
          <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center">
            <div aria-hidden className="absolute inset-4 rounded-full bg-[radial-gradient(circle,#F6EBEA_0%,#F6EBEA_55%,transparent_70%)]" />
            <img src={sideCar} alt="" className="relative w-full mix-blend-multiply" />
          </div>
          <ul className="space-y-10">{BENEFITS.slice(3).map((b) => <Benefit key={b.title} b={b} align="right" />)}</ul>
        </div>
      </section>

      {/* ── Most popular car deals ─────────────────────────────────────────── */}
      <section className="bg-[#FBF9F5] py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className={pill}>Popular Rental Deals</p>
          <h2 className={heading}>Most Popular Car Deals</h2>
          <div className="mt-10">
            <CarDeals classes={classes} />
          </div>
          <div className="mt-10 flex items-center justify-center gap-6">
            <Link href="/fleet" className="inline-flex items-center gap-2 rounded-md border border-[#2D2C2C] px-5 py-2 text-sm font-semibold hover:bg-[#2D2C2C] hover:text-white">
              Show all vehicles <ArrowRightIcon className="size-4" />
            </Link>
            <span className="text-sm text-[#818080]">{classes.length} vehicle classes</span>
          </div>
        </div>
      </section>

      {/* ── Brands (makes in our fleet) ────────────────────────────────────── */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className={pill}>Brands</p>
          <h2 className={heading}>Trusted Brands We Offer</h2>
          <ul className="mt-10 flex flex-wrap justify-center gap-4">
            {brands.map((b) => (
              <li key={b} className="grid h-16 min-w-36 place-items-center rounded-xl border border-[#EAEAEA] bg-white px-6 text-lg font-extrabold tracking-wider text-[#575656] uppercase shadow-[0_6px_20px_-14px_rgba(45,44,44,0.4)] transition-colors hover:border-[#9D302D] hover:text-[#9D302D]">
                {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Call to action, half over the dark footer ──────────────────────── */}
      <section className="-mb-16 bg-[linear-gradient(to_bottom,white_55%,#242323_55%)] px-4 pb-16">
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 overflow-hidden rounded-3xl bg-[#9D302D] bg-[linear-gradient(135deg,rgba(157,48,45,0.95),rgba(120,36,34,0.98)),url('/assest/pattern%20bg.png')] bg-[length:auto,280px_auto] p-8 text-white md:grid-cols-2 md:p-12">
          <img src={HERO_CAR} alt="" className="w-full max-w-md rounded-2xl bg-white/95 p-3 md:justify-self-start" />
          <div>
            <h2 className="font-serif text-3xl leading-tight font-bold md:text-4xl">Ready to Hit the Road?<br />Book Your Ride Today</h2>
            <p className="mt-3 text-white/80">Check prices for your dates and reserve online in minutes.</p>
            <a href="#book" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#9D302D] hover:bg-[#F6EBEA]">
              Rent Now <ArrowRightIcon className="size-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
