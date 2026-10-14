"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon, UserMinusIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, dateTime, fuel, fullName } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { errorMessage } from "../../../../../_components/form";
import { Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";

export function DriversTab({ data }: { data: RentalData }) {
  const r = data.rental;
  const { api, run } = useRentalActions(r.id);
  const [removing, setRemoving] = React.useState<{ id: string; name: string } | null>(null);
  const segments = r.vehicleSegments;

  return (
    <div className="grid gap-4">
      <Section title="Additional drivers" count={r.drivers.length} flush action={<AddDriverDialog rentalId={r.id} existing={r.drivers.map((d) => d.customerId).concat(r.customerId)} />}>
        {r.drivers.length === 0 ? (
          <Empty>No additional drivers.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full name</TableHead>
                <TableHead>Licence #</TableHead>
                <TableHead>Licence expiration</TableHead>
                <TableHead>Postal code</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link href={`/admin/customers/${d.customerId}`} className="text-primary hover:underline">
                      {fullName(d.customer)}
                    </Link>
                  </TableCell>
                  <TableCell>{d.customer.licenseNumber ?? "—"}</TableCell>
                  <TableCell>{date(d.customer.licenseExpiry)}</TableCell>
                  <TableCell>{d.customer.postal ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${fullName(d.customer)}`}
                      onClick={() => setRemoving({ id: d.id, name: fullName(d.customer) })}
                    >
                      <UserMinusIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ConfirmAction
          open={removing !== null}
          onOpenChange={(o) => !o && setRemoving(null)}
          destructive
          title="Remove additional driver"
          description={<>Remove <b>{removing?.name}</b> from this rental? The customer record is kept.</>}
          confirmLabel="Remove driver"
          onConfirm={() => run(api.removeDriver.mutate({ bookingDriverId: removing!.id }))}
        />
      </Section>

      <Section title="Vehicle history" count={Math.max(segments.length, 1)} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Return</TableHead>
              <TableHead className="text-right">Odometer out</TableHead>
              <TableHead className="text-right">Odometer in</TableHead>
              <TableHead>Fuel out</TableHead>
              <TableHead>Fuel in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(segments.length
              ? segments
              : [{ id: "current", vehicle: r.vehicle, startsAt: r.checkOutAt, endsAt: r.checkedInAt, odometerOut: r.odometerOut, odometerIn: r.odometerIn, fuelOut: r.fuelOut, fuelIn: r.fuelIn }]
            ).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  {s.vehicle.make.name} {s.vehicle.model.name} <span className="text-muted-foreground">({s.vehicle.assignedId})</span>
                </TableCell>
                <TableCell>{dateTime(s.startsAt)}</TableCell>
                <TableCell>{s.endsAt ? dateTime(s.endsAt) : <Badge variant="success">Current</Badge>}</TableCell>
                <TableCell className="text-right tabular-nums">{s.odometerOut.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.odometerIn?.toLocaleString() ?? "—"}</TableCell>
                <TableCell>{fuel(s.fuelOut)}</TableCell>
                <TableCell>{fuel(s.fuelIn)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}

function AddDriverDialog({ rentalId, existing }: { rentalId: string; existing: string[] }) {
  const trpc = useTRPC();
  const { api, run } = useRentalActions(rentalId);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const results = useQuery({ ...trpc.staff.rental.searchDrivers.queryOptions({ q }), enabled: q.trim().length >= 2 });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusIcon /> Add driver
        </Button>
      </DialogTrigger>
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
            const already = existing.includes(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
                <div>
                  <div className="font-medium">
                    {fullName(c)} {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Licence {c.licenseNumber ?? "—"} · exp. {date(c.licenseExpiry)}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={already || c.isUndesired}
                  onClick={async () => {
                    try {
                      await run(api.addDriver.mutate({ rentalId, customerId: c.id }));
                      toast.success(`${fullName(c)} added`);
                      setOpen(false);
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  {already ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Not a customer yet?{" "}
          <Link href="/admin/customers/new" className="text-primary hover:underline">
            Add a new customer
          </Link>{" "}
          first.
        </p>
      </DialogContent>
    </Dialog>
  );
}
