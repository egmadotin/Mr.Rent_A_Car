"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon, UserMinusIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { date, fullName } from "@mrac/ui/lib/format";
import type { BookingOptions, BookingOptionsData } from "./options-grid";

/** An additional driver picked on the form (an existing customer). */
export type DriverPick = { id: string; firstName: string; lastName: string; licenseNumber: string | null; licenseExpiry: Date | string | null };

/**
 * Keep the "Additional driver is added" charges (Settings > Misc Charges) ticked in the options grid with one unit per
 * additional driver, as RentCentric adds them when drivers are added; with no drivers they are unticked.
 */
export function withDriverCharges(opts: BookingOptions, data: BookingOptionsData | undefined, count: number): BookingOptions {
  const ids = new Set((data?.misc ?? []).filter((m) => m.autoWhenAdditionalDriver).map((m) => m.id));
  if (!ids.size) return opts;
  const rest = opts.miscCharges.filter((m) => !ids.has(m.miscChargeId));
  return { ...opts, miscCharges: count > 0 ? [...rest, ...[...ids].map((id) => ({ miscChargeId: id, quantity: count }))] : rest };
}

/** "Drivers / Add More Drivers" on the Customer tab: additional drivers saved with the booking. */
export function DriversCard({ drivers, onChange, primaryId }: { drivers: DriverPick[]; onChange: (d: DriverPick[]) => void; primaryId?: string | null }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Drivers</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><PlusIcon /> Add More Drivers</Button>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional drivers.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {drivers.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 p-2">
                <span>
                  <Link href={`/admin/customers/${d.id}`} target="_blank" className="font-medium text-primary hover:underline">{fullName(d)}</Link>{" "}
                  <span className="text-muted-foreground">Licence {d.licenseNumber ?? "—"} · exp. {date(d.licenseExpiry)}</span>
                </span>
                <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={`Remove ${fullName(d)}`} onClick={() => onChange(drivers.filter((x) => x.id !== d.id))}>
                  <UserMinusIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <DriverSearch open={open} onOpenChange={setOpen} exclude={[...drivers.map((d) => d.id), ...(primaryId ? [primaryId] : [])]} onPick={(c) => onChange([...drivers, c])} />
    </Card>
  );
}

function DriverSearch({ open, onOpenChange, exclude, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; exclude: string[]; onPick: (c: DriverPick) => void }) {
  const trpc = useTRPC();
  const [q, setQ] = React.useState("");
  const results = useQuery({ ...trpc.staff.rental.searchDrivers.queryOptions({ q }), enabled: q.trim().length >= 2 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add additional driver</DialogTitle>
          <DialogDescription>Search existing customers by name, licence number or phone.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Start typing…" autoFocus aria-label="Search customers" />
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
          {q.trim().length < 2 && <li className="p-3 text-sm text-muted-foreground">Type at least 2 characters.</li>}
          {results.data?.length === 0 && <li className="p-3 text-sm text-muted-foreground">No customers found.</li>}
          {results.data?.map((c) => {
            const already = exclude.includes(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <div>
                  <div className="font-medium">{fullName(c)} {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}</div>
                  <div className="text-xs text-muted-foreground">Licence {c.licenseNumber ?? "—"} · exp. {date(c.licenseExpiry)}</div>
                </div>
                <Button type="button" size="sm" disabled={already || c.isUndesired} onClick={() => { onPick(c); onOpenChange(false); setQ(""); }}>
                  {already ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Not a customer yet? <Link href="/admin/customers/new" target="_blank" className="text-primary hover:underline">Add a new customer</Link> first.
        </p>
      </DialogContent>
    </Dialog>
  );
}
