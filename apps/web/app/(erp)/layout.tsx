import type { Metadata } from "next";
import { Libre_Baskerville } from "next/font/google";
import { Providers } from "./_components/providers";
import "./erp.css";

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mr Rent A Car ERP", template: "%s · Mr Rent A Car ERP" },
  robots: { index: false, follow: false },
};

/** Root layout for the staff ERP. Uses the authoritative luxury automotive workstation theme from design.md. */
export default function ErpRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="erp" className={libreBaskerville.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased bg-erp-canvas-pattern text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
