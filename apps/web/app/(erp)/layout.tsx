import type { Metadata } from "next";
import { fontVariables } from "../_fonts/fonts";
import { Providers } from "./_components/providers";
import "./erp.css";

export const metadata: Metadata = {
  title: { default: "Mr. Rent A Car ERP", template: "%s · Mr. Rent A Car ERP" },
  robots: { index: false, follow: false },
};

/** Root layout for the staff ERP — the Mr. Rent A Car design system, denser. */
export default function ErpRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="erp" className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
