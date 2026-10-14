import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { cn } from "@mrac/ui/lib/utils";

export function Section({
  title,
  count,
  action,
  children,
  className,
  flush,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** no inner padding — for tables */
  flush?: boolean;
}) {
  return (
    <Card className={cn("gap-3", flush && "pb-0", className)}>
      <CardHeader className="items-center">
        <CardTitle>
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-muted-foreground">({count})</span>}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn(flush && "px-0")}>{children}</CardContent>
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-4 text-sm text-muted-foreground">{children}</p>;
}

/** Two-column label/value list used for rental details. */
export function DetailList({ items }: { items: [label: string, value: React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[9rem_1fr] gap-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value === null || value === undefined || value === "" ? "—" : value}</dd>
        </div>
      ))}
    </dl>
  );
}
