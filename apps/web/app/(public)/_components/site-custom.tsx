"use client";

import * as React from "react";

/**
 * Settings > Website Design V3 code fields (Google Analytics / Conversion code): HTML with <script>s, added to the page
 * so the scripts run (React doesn't run scripts given as HTML). Removed again when the page changes.
 */
export function InjectHtml({ html, target = "head" }: { html: string; target?: "head" | "body" }) {
  React.useEffect(() => {
    if (!html.trim()) return;
    const parent = target === "head" ? document.head : document.body;
    const nodes = Array.from(document.createRange().createContextualFragment(html).childNodes);
    for (const n of nodes) parent.appendChild(n);
    return () => {
      for (const n of nodes) n.parentNode?.removeChild(n);
    };
  }, [html, target]);
  return null;
}
