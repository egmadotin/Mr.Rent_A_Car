"use client";

import * as React from "react";

/**
 * Base styles of RentCentric's print page. The templates set their own sizes and borders (`border="1"`, `.auto-style3 td`),
 * so they need the browser defaults, not our app's CSS reset, which zeroes every border and turns images into blocks.
 * Tahoma 9px is the base text the templates inherit: with it the Open Contract wraps line for line like the client's
 * printed sample.
 */
const BASE = `
:host { all: initial; display: block; color: #000; background: #fff; font-family: Tahoma, Verdana, sans-serif; font-size: 9px; }
img { max-width: none; }
`;

/** Printed page: Letter with 1cm margins (see PRINT_CSS in print/_components/template-print.tsx), in CSS px. */
const MARGIN = 96 / 2.54;
const PAGE_W = 8.5 * 96 - 2 * MARGIN;
const PAGE_H = 11 * 96 - 2 * MARGIN - 2; // a hair under, so rounding never spills a blank second page

/**
 * A rendered RentCentric-style template (contract, invoice, confirmation), isolated from the ERP's styles in a shadow root.
 * `fitPage`: like RentCentric's printouts, it always prints on one page — just before printing it is laid out at the page
 * width and scaled down when taller than the page.
 */
export function LegacyDocument({ html, className, fitPage }: { html: string; className?: string; fitPage?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${BASE}</style>${html}`;
  }, [html]);

  React.useEffect(() => {
    const el = ref.current;
    if (!fitPage || !el) return;
    const fit = () => {
      el.style.zoom = "";
      el.style.width = `${PAGE_W}px`;
      const z = Math.min(1, PAGE_H / el.scrollHeight, PAGE_W / el.scrollWidth);
      // 3% to spare: scaled text rounds a little taller than measured
      if (z < 1) el.style.zoom = String(Math.max(z * 0.97, 0.5));
    };
    const reset = () => {
      el.style.zoom = "";
      el.style.width = "";
    };
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", reset);
    return () => {
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", reset);
    };
  }, [fitPage]);

  return <div ref={ref} className={className} />;
}
