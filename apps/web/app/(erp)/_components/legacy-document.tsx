"use client";

import * as React from "react";

/**
 * Base styles of RentCentric's print page. The templates set their own sizes and borders (`border="1"`, `.auto-style3 td`),
 * so they need the browser defaults, not our app's CSS reset, which zeroes every border and turns images into blocks.
 * Tahoma 9px is the base text the templates inherit: with it the Open Contract wraps line for line like the client's
 * printed sample and fits one Letter page.
 */
const BASE = `
:host { all: initial; display: block; color: #000; background: #fff; font-family: Tahoma, Verdana, sans-serif; font-size: 9px; }
img { max-width: none; }
`;

/** A rendered RentCentric-style template (contract, invoice, confirmation), isolated from the ERP's styles in a shadow root. */
export function LegacyDocument({ html, className }: { html: string; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${BASE}</style>${html}`;
  }, [html]);
  return <div ref={ref} className={className} />;
}
