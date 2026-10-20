import type { Metadata } from "next";
import { Libre_Baskerville, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./_components/providers";
import { SiteFooter, SiteHeader } from "./_components/site-chrome";
import "./public.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
/** design.md: Libre Baskerville for headings */
const baskerville = Libre_Baskerville({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-baskerville", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Car Rentals in Vancouver & Calgary | Mr Rent A Car", template: "%s | Mr Rent A Car" },
  description: "Rent a car in Surrey, Coquitlam and Calgary. Economy to luxury, minivans and SUVs.",
};

/** Root layout for the public marketing/booking site. Separate <html> from the ERP. */
export default function PublicRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="public" className={`${jakarta.variable} ${baskerville.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col font-sans">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
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
