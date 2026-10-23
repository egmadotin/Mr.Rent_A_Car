"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@mrac/ui/components/table";
import { cn } from "@mrac/ui/lib/utils";

const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role='button'], [role='menuitem'], [role='checkbox'], [data-row-ignore]";

/**
 * A table row that opens `href` when clicked anywhere on it. Clicks on links, buttons and inputs inside the
 * row keep their own behaviour; Ctrl/Cmd/middle-click opens a new tab; selecting text doesn't navigate.
 * The record number stays a real <Link> in the row for keyboard and screen-reader users.
 */
export function LinkRow({ href, className, children, ...props }: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();

  const open = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(href, "_blank", "noopener");
      return;
    }
    if (e.button === 0) router.push(href);
  };

  return (
    <TableRow
      {...props}
      onClick={open}
      onAuxClick={(e) => e.button === 1 && open(e)}
      onMouseEnter={() => router.prefetch(href)}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </TableRow>
  );
}
