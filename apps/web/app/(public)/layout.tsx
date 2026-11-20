import type { Metadata } from "next";
import { fontVariables } from "../_fonts/fonts";
import { Providers } from "./_components/providers";
import { SiteFooter, SiteHeader } from "./_components/site-chrome";
import "./public.css";

export const metadata: Metadata = {
  title: { default: "Car Rentals in Vancouver & Calgary | Mr. Rent A Car", template: "%s | Mr. Rent A Car" },
  description: "Locally owned car rental in Metro Vancouver and Calgary since 1996. Economy to Signature, all-in prices, taxes in.",
};

/** Root layout for the public marketing/booking site. Separate <html> from the ERP. */
export default function PublicRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="public" className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
