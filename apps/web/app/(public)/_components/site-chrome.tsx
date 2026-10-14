"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLinkIcon, MenuIcon, PhoneIcon, XIcon } from "lucide-react";
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
  { href: "/blogs", label: "Blogs" },
];

export const PHONE = { display: "1.844.mmrrent (667.7368)", tel: "+18446677368" };

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-sm">
          <a href={`tel:${PHONE.tel}`} className="flex items-center gap-2 hover:underline">
            <PhoneIcon className="size-3.5" /> {PHONE.display}
          </a>
        </div>
      </div>
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
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="text-lg font-bold">Mr. <span className="text-primary">rent a car</span></div>
          <p className="mt-2 text-sm opacity-80">Car rentals in Vancouver and Calgary since 1996.</p>
        </div>
        <nav aria-label="Footer" className="grid gap-1 text-sm">
          {NAV.filter((n) => !n.external).map((n) => (
            <Link key={n.href} href={n.href} className="opacity-80 hover:underline hover:opacity-100">{n.label}</Link>
          ))}
        </nav>
        <div className="text-sm">
          <a href={`tel:${PHONE.tel}`} className="block hover:underline">{PHONE.display}</a>
          <a href="mailto:info@mrrentacar.com" className="block opacity-80 hover:underline">info@mrrentacar.com</a>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs opacity-70">© {new Date().getFullYear()} Mr Rent A Car</div>
    </footer>
  );
}
