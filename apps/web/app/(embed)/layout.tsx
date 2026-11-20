import type { Metadata } from "next";
import { fontVariables } from "../_fonts/fonts";
import "../(public)/public.css";

export const metadata: Metadata = { title: "Mr. Rent A Car", robots: { index: false } };

/** Bare pages for other websites to show in a frame (Settings > Widget/Rotator Setup): no site header or footer. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="public" className={fontVariables}>
      <body className="bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
