"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronUpIcon,
  ClockIcon,
  ExternalLinkIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  PhoneIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { cn } from "@mrac/ui/lib/utils";
import { BrandLogo } from "@mrac/ui/components/brand-logo";

/** Same menu as mrrentacar.com. "Car for Sale" is the sister business on its own domain. */
const NAV = [
  { href: "/", label: "Home" },
  { href: "https://www.mrautosaleslease.com/", label: "Car for Sale", external: true },
  { href: "/fleet", label: "Fleet" },
  { href: "/our-locations", label: "Our Locations" },
  { href: "/about-us", label: "About Us" },
  { href: "/our-services", label: "Our Services" },
  { href: "/contact-us", label: "Contact Us" },
];

export const PHONE = { display: "1.844.mmrrent (667.7368)", tel: "+18446677368" };

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const trpc = useTRPC();
  const me = useQuery(trpc.account.me.queryOptions()).data;
  const account = me
    ? { href: "/account", label: me.name.split(" ")[0] || "My Account" }
    : { href: `/account/login${pathname.startsWith("/book") || pathname.startsWith("/account") ? "" : `?next=${encodeURIComponent(pathname)}`}`, label: "Login" };

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center" aria-label="Mr Rent A Car home">
            <BrandLogo className="h-11" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) =>
              n.external ? (
                <a key={n.href} href={n.href} target="_blank" rel="noopener" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:text-primary">
                  {n.label} <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cn("rounded-md px-3 py-2 text-sm font-medium hover:text-primary", active(n.href) && "bg-primary text-primary-foreground hover:text-primary-foreground")}
                >
                  {n.label}
                </Link>
              ),
            )}
            <Link href={account.href} className={cn("ml-1 flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:text-primary", active("/account") && "border-primary text-primary")}>
              <UserIcon className="size-4" /> {account.label}
            </Link>
          </nav>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
        {open && (
          <nav aria-label="Main" className="border-t px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} target={n.external ? "_blank" : undefined} rel={n.external ? "noopener" : undefined} className={cn("block rounded-md px-3 py-2.5 font-medium", !n.external && active(n.href) && "bg-accent text-accent-foreground")}>
                {n.label}
              </a>
            ))}
            <Link href={account.href} className={cn("flex items-center gap-2 rounded-md px-3 py-2.5 font-medium", active("/account") && "bg-accent text-accent-foreground")}>
              <UserIcon className="size-4" /> {me ? "My Account" : "Login"}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="relative mt-16 overflow-hidden bg-[#242323] text-[#E9E3D5] selection:bg-[#9D302D] selection:text-white">
      {/* Subtle luxury ambient glow at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-[#9D302D]/10 blur-3xl" />

      {/* Main Footer Content */}
      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Col 1: Brand & Identity (4 cols) */}
          <div className="space-y-5 lg:col-span-4">
            <Link href="/" className="inline-block transition-transform hover:scale-[1.02]">
              <BrandLogo variant="white" className="h-10 w-auto" />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              Vancouver &amp; Calgary&apos;s trusted independent car rental company since 1996. Clean, reliable vehicles, upfront pricing with zero surprises, and seamless 24/7 key-drop returns.
            </p>

            <div className="space-y-2.5 pt-1 text-xs text-white/60">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#9D302D]/20 text-[#B15957]">✓</span>
                <span>Serving BC &amp; Alberta for over 29 years</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#9D302D]/20 text-[#B15957]">✓</span>
                <span>Airport pickup &amp; delivery at YVR and YYC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#9D302D]/20 text-[#B15957]">✓</span>
                <span>24/7 automated secure key drop-box</span>
              </div>
            </div>
          </div>

          {/* Col 2: Fleet Classes (3 cols) */}
          <div className="space-y-4 lg:col-span-3">
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-white uppercase">
              <span className="inline-block size-1.5 rounded-full bg-[#9D302D]" />
              Vehicle Fleet
            </h3>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  Economy &amp; Compact Cars
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  Full-Size &amp; Midsize Sedans
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  Compact &amp; Standard SUVs
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  7 &amp; 8 Passenger Minivans
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  Electric Vehicles (Tesla Model 3, EQB)
                </Link>
              </li>
              <li>
                <Link href="/fleet" className="transition-colors hover:text-white hover:underline">
                  Cargo Vans &amp; Pickup Trucks
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Quick Navigation (2 cols) */}
          <div className="space-y-4 lg:col-span-2">
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-white uppercase">
              <span className="inline-block size-1.5 rounded-full bg-[#9D302D]" />
              Explore
            </h3>
            <ul className="space-y-2.5 text-sm text-white/70">
              {NAV.map((n) =>
                n.external ? (
                  <li key={n.href}>
                    <a
                      href={n.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-white hover:underline"
                    >
                      {n.label} <ExternalLinkIcon className="size-3 opacity-60" />
                    </a>
                  </li>
                ) : (
                  <li key={n.href}>
                    <Link href={n.href} className="transition-colors hover:text-white hover:underline">
                      {n.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Col 4: Contact & Locations (3 cols) */}
          <div className="space-y-4 lg:col-span-3">
            <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-white uppercase">
              <span className="inline-block size-1.5 rounded-full bg-[#9D302D]" />
              Get In Touch
            </h3>

            <div className="space-y-3 text-sm text-white/75">
              <div className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 size-4 shrink-0 text-[#B15957]" />
                <div>
                  <a href={`tel:${PHONE.tel}`} className="font-semibold text-white transition-colors hover:text-[#B15957]">
                    {PHONE.display}
                  </a>
                  <p className="text-xs text-white/50">Toll-free Canada &amp; USA</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MailIcon className="mt-0.5 size-4 shrink-0 text-[#B15957]" />
                <div>
                  <a href="mailto:info@mrrentacar.com" className="font-medium text-white transition-colors hover:text-[#B15957]">
                    info@mrrentacar.com
                  </a>
                  <p className="text-xs text-white/50">Reservations &amp; Customer Care</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <MapPinIcon className="mt-0.5 size-4 shrink-0 text-[#B15957]" />
                <div className="text-xs leading-relaxed text-white/60">
                  <p className="font-semibold text-white/80">Major Rental Hubs</p>
                  <p>Vancouver YVR (Richmond) • Calgary YYC (Airport)</p>
                  <p>Burnaby • Surrey • Vancouver Admin</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 size-4 shrink-0 text-[#B15957]" />
                <div className="text-xs text-white/60">
                  <p className="font-semibold text-white/80">Hours</p>
                  <p>Open Daily • 24hr Key Drop Box Available</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BIG BIG STYLISH COMPANY NAME AT THE BOTTOM ─────────────────── */}
        <div className="relative mt-16 pt-10 pb-2 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#9D302D]/60 sm:w-28" />
            <span className="text-[10px] font-bold tracking-[0.32em] text-[#B15957] uppercase sm:text-xs">
              Canada&apos;s Independent Car Rental Choice • Since 1996
            </span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#9D302D]/60 sm:w-28" />
          </div>

          <div
            className="group relative select-none font-black tracking-tighter uppercase leading-[0.8] transition-all duration-700"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            <span className="block text-[11.5vw] sm:text-[13vw] md:text-[14.5vw] lg:text-[15.5vw] bg-gradient-to-b from-white/[0.24] via-white/[0.09] to-white/[0.02] bg-clip-text text-transparent group-hover:from-white/[0.42] group-hover:via-white/[0.18] transition-all duration-700">
              MR. RENT A CAR
            </span>
          </div>
        </div>

        {/* ── Sub Footer: Copyright & Legal ───────────────────────────── */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-white/[0.08] pt-6 text-xs text-white/50 sm:flex-row">
          <p>© {currentYear} Mr. Rent A Car Ltd. All rights reserved.</p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-white/60">
            <Link href="/fleet" className="transition-colors hover:text-white">
              Fleet Guide
            </Link>
            <Link href="/our-locations" className="transition-colors hover:text-white">
              Locations
            </Link>
            <Link href="/contact-us" className="transition-colors hover:text-white">
              Contact &amp; Support
            </Link>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white cursor-pointer"
              aria-label="Back to top"
            >
              <span>Back to Top</span>
              <ChevronUpIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
