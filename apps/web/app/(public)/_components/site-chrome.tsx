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
      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Col 1: Brand & Identity (5 cols) */}
          <div className="space-y-5 lg:col-span-5">
            <Link href="/" className="inline-block transition-transform hover:scale-[1.02]">
              <BrandLogo variant="white" className="h-10 w-auto" />
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-white/70">
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

          {/* Col 2: Quick Navigation (3 cols) */}
          <div className="space-y-4 lg:col-span-3">
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

          {/* Col 3: Contact & Locations (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
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
        <div className="relative mt-12 pt-8 pb-1 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#9D302D]/60 sm:w-24" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#B15957] uppercase sm:text-xs">
              Canada&apos;s Independent Car Rental Choice • Since 1996
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#9D302D]/60 sm:w-24" />
          </div>

          {/* SVG Vector Watermark: 100% responsive, never crops, stays on ONE single line on all screen sizes */}
          <div className="group relative w-full overflow-hidden select-none transition-all duration-700">
            <svg
              viewBox="0 0 1120 100"
              className="w-full h-auto max-w-full drop-shadow-sm select-none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Mr. Rent A Car"
            >
              <defs>
                <linearGradient id="footer-brand-watermark-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <text
                x="50%"
                y="55%"
                dominantBaseline="middle"
                textAnchor="middle"
                fill="url(#footer-brand-watermark-grad)"
                className="font-black uppercase transition-all duration-700 group-hover:opacity-100"
                style={{
                  fontFamily: "var(--font-jakarta), var(--font-sans), ui-sans-serif, system-ui, sans-serif",
                  fontWeight: 900,
                  fontSize: "96px",
                  letterSpacing: "-0.04em",
                }}
              >
                MR. RENT A CAR
              </text>
            </svg>
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
