"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, MailIcon, MenuIcon, PhoneIcon, UserIcon, XIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { cn } from "@mrac/ui/lib/utils";
import { BrandLogo } from "@mrac/ui/components/brand-logo";

/** Same destinations as mrrentacar.com. "Cars for sale" is the sister business on its own domain. */
const NAV = [
  { href: "/fleet", label: "Fleet" },
  { href: "/our-locations", label: "Locations" },
  { href: "/our-services", label: "Services" },
  { href: "/about-us", label: "About" },
  { href: "/contact-us", label: "Contact" },
  { href: "https://www.mrautosaleslease.com/", label: "Cars for sale", external: true },
];

export const PHONE = { display: "1-844-667-7368", tel: "+18446677368" };

/** 76px sheet header: wordmark, nav with the red active underline, help one tap away, account. */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const trpc = useTRPC();
  const me = useQuery(trpc.account.me.queryOptions()).data;
  const account = me
    ? { href: "/account", label: me.name.split(" ")[0] || "My account" }
    : {
        href: `/account/login${pathname.startsWith("/book") || pathname.startsWith("/account") ? "" : `?next=${encodeURIComponent(pathname)}`}`,
        label: "Log in",
      };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-card/90 backdrop-blur-md transition-shadow duration-180 supports-[backdrop-filter]:bg-card/80",
        scrolled ? "border-border shadow-primary" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-(--header-height) max-w-[1280px] items-center gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="Mr. Rent A Car home" className="shrink-0 rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:outline-none">
          <BrandLogo />
        </Link>

        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 lg:flex">
          {NAV.map((n) =>
            n.external ? (
              <a key={n.href} href={n.href} target="_blank" rel="noopener" className="flex items-center gap-1 px-3 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                {n.label} <ArrowUpRightIcon className="size-3.5" />
              </a>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-3 text-[15px] font-medium transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-brand after:transition-transform after:duration-180",
                  active(n.href) ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={`tel:${PHONE.tel}`}
            className="hidden h-10 items-center gap-2 rounded-pill px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted md:flex"
          >
            <PhoneIcon className="size-4" /> {PHONE.display}
          </a>
          <Link
            href={account.href}
            className={cn(
              "hidden h-10 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors hover:bg-muted sm:flex",
              active("/account") && "border-foreground",
            )}
          >
            <UserIcon className="size-4" /> {account.label}
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-pill hover:bg-muted lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Main" className="fixed inset-x-0 top-(--header-height) bottom-0 z-40 overflow-y-auto border-t bg-card px-4 pt-3 pb-10 lg:hidden">
          <ul className="divide-y">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  target={n.external ? "_blank" : undefined}
                  rel={n.external ? "noopener" : undefined}
                  className={cn("flex items-center justify-between py-4 text-lg font-semibold", !n.external && active(n.href) && "text-brand")}
                >
                  {n.label}
                  {n.external && <ArrowUpRightIcon className="size-4 text-muted-foreground" />}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-3">
            <Link href={account.href} className="flex h-12 items-center justify-center gap-2 rounded-control border text-[15px] font-semibold">
              <UserIcon className="size-4" /> {me ? "My account" : "Log in"}
            </Link>
            <a href={`tel:${PHONE.tel}`} className="flex h-12 items-center justify-center gap-2 rounded-control bg-foreground text-[15px] font-semibold text-background">
              <PhoneIcon className="size-4" /> Call {PHONE.display}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}

const FOOTER_LOCATIONS = ["Vancouver Airport (YVR)", "Richmond", "Burnaby", "Surrey", "Calgary Airport (YYC)"];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t bg-card">
      <div className="mx-auto max-w-[1280px] px-4 pt-14 pb-8 sm:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <BrandLogo />
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              A locally owned car rental company serving Metro Vancouver and Calgary since 1996. Premium service at every price point.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={`tel:${PHONE.tel}`} className="inline-flex h-10 items-center gap-2 rounded-pill border px-4 text-sm font-semibold hover:bg-muted">
                <PhoneIcon className="size-4" /> {PHONE.display}
              </a>
              <a href="mailto:info@mrrentacar.com" className="inline-flex h-10 items-center gap-2 rounded-pill border px-4 text-sm font-semibold hover:bg-muted">
                <MailIcon className="size-4" /> Email us
              </a>
            </div>
          </div>

          <FooterCol title="Rent" className="lg:col-span-2">
            <FooterLink href="/fleet">All vehicles</FooterLink>
            <FooterLink href="/book">Find a car</FooterLink>
            <FooterLink href="/our-services">Services</FooterLink>
            <FooterLink href="/account">My bookings</FooterLink>
          </FooterCol>

          <FooterCol title="Locations" className="lg:col-span-3">
            {FOOTER_LOCATIONS.map((l) => (
              <FooterLink key={l} href="/our-locations">{l}</FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Company" className="lg:col-span-3">
            <FooterLink href="/about-us">About us</FooterLink>
            <FooterLink href="/blogs">Blog</FooterLink>
            <FooterLink href="/contact-us">Contact</FooterLink>
            <li>
              <a href="https://www.mrautosaleslease.com/" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[15px] text-muted-foreground transition-colors hover:text-foreground">
                Cars for sale <ArrowUpRightIcon className="size-3.5" />
              </a>
            </li>
          </FooterCol>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Mr. Rent A Car Ltd. All prices in CAD.</p>
          <p>Open daily · 24-hour key drop available</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-[15px] text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
