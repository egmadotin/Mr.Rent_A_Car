import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./_components/providers";
import "./erp.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Mr Rent A Car ERP", template: "%s · Mr Rent A Car ERP" },
  robots: { index: false, follow: false },
};

/** Root layout for the staff ERP. Separate <html> from the public site: own brand, own theme storage. */
export default function ErpRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="erp" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
