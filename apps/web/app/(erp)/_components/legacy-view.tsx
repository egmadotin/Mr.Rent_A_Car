"use client";

import * as React from "react";
import Link from "next/link";

/** "Label:  value" rows, as on the RentCentric *Main.aspx view pages. */
export function DL({ items, single }: { items: [string, React.ReactNode][]; single?: boolean }) {
  return (
    <dl className={single ? "grid gap-y-2 text-sm" : "grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2"}>
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr] gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One of the RentCentric action links on a view page (opens a panel, a dialog, or a page). */
export function ActionLink({
  children,
  onClick,
  href,
  newTab,
  disabled,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  newTab?: boolean;
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  if (disabled) return <span className="cursor-not-allowed text-muted-foreground" title={title}>{children}</span>;
  if (href) return <Link href={href} target={newTab ? "_blank" : undefined} className="text-primary hover:underline">{children}</Link>;
  return <button type="button" onClick={onClick} className={active ? "font-medium text-primary underline" : "text-primary hover:underline"}>{children}</button>;
}
