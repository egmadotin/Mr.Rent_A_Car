"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@mrac/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, dateTime, fuel, fullName, money } from "@mrac/ui/lib/format";
import { TransportDialog } from "../../../../../_components/booking-dialogs";
import { DetailList, Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";

export function OverviewTab({ data }: { data: RentalData }) {
  const r = data.rental;
  const c = r.customer;
  const { api, run } = useRentalActions(r.id);
  const kmDriven = r.odometerIn != null ? r.odometerIn - r.odometerOut : null;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Section title="Rental details" className="xl:col-span-2">
        <DetailList
          items={[
            ["Type", r.vehicleType.name],
            ["Vehicle", <React.Fragment key="v">({r.vehicle.assignedId}) {r.vehicle.make.name} {r.vehicle.model.name}</React.Fragment>],
            ["Pickup date", dateTime(r.checkOutAt)],
            ["Pickup location", r.checkOutLocation.name],
            ["Return date", r.checkedInAt ? dateTime(r.checkedInAt) : <React.Fragment key="rd">{dateTime(r.expectedReturnAt)} <span className="text-muted-foreground">(expected)</span></React.Fragment>],
            ["Return location", r.checkInLocation.name],
            ["Opened by", r.openedBy?.name],
            ["Closed by", r.closedBy?.name],
            ["Check-out channel", r.checkOutChannel],
            ["Check-in channel", r.checkInChannel],
            ["Company", r.company ? r.company.name : "N/A"],
            ["Referral", r.referral?.name ?? "N/A"],
            ["Rate", r.rate?.code],
            ["Deposit", r.deposit ? money(r.deposit) : null],
            ["Odometer out / in", <React.Fragment key="odo">{r.odometerOut.toLocaleString()} / {r.odometerIn?.toLocaleString() ?? "—"}{kmDriven != null && <span className="text-muted-foreground"> · {kmDriven.toLocaleString()} km driven</span>}</React.Fragment>],
            ["Fuel out / in", `${fuel(r.fuelOut)} / ${fuel(r.fuelIn)}`],
            ["PO# / RO#", [r.poNumber, r.roNumber].filter(Boolean).join(" / ")],
            ["Claim #", r.claimNumber],
            ["Airport / flight", [r.airport, r.airline, r.flightNumber].filter(Boolean).join(" · ")],
            ["Rental reason", r.rentalReason?.name],
            ["Flags", <span key="flags" className="flex flex-wrap gap-1">{r.isLongTerm && <Badge variant="info">Long term</Badge>}{r.isNonRevenue && <Badge variant="muted">Non-revenue</Badge>}{r.prepaidFuel && <Badge variant="muted">Prepaid fuel</Badge>}{!r.isLongTerm && !r.isNonRevenue && !r.prepaidFuel && "—"}</span>],
            ["Exchange rate", r.exchangeRate ? String(r.exchangeRate) : null],
            ["Original reservation", r.reservation ? <Link key="res" className="text-primary hover:underline" href={`/admin/reservations/${r.reservation.id}`}>#{r.reservation.number}</Link> : null],
          ]}
        />
      </Section>

      <Section title="Renter">
        <div className="space-y-3 text-sm">
          <div>
            <Link href={`/admin/customers/${c.id}`} className="text-base font-medium text-primary hover:underline">
              {fullName(c)}
            </Link>
            {c.isUndesired && <Badge variant="destructive" className="ml-2">Undesired</Badge>}
          </div>
          <DetailList
            items={[
              ["Phone", c.phone],
              ["Email", c.email],
              ["Licence #", c.licenseNumber],
              ["Licence exp.", date(c.licenseExpiry)],
              ["Date of birth", date(c.birthDate)],
              ["ID verified", c.identityVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="muted">Not verified</Badge>],
            ]}
          />
        </div>
      </Section>

      <Section
        title="Pickup / drop-off"
        count={r.transports.length}
        flush
        className="xl:col-span-3"
        action={
          <TransportDialog onSubmit={(p) => run(api.addTransport.mutate({ rentalId: r.id, ...p }))} />
        }
      >
        {r.transports.length === 0 ? (
          <Empty>No delivery or collection booked.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pickup location</TableHead>
                <TableHead>Pickup date</TableHead>
                <TableHead>Drop-off location</TableHead>
                <TableHead>Drop-off date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.transports.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.pickupLocation?.name ?? t.pickupAddress ?? "—"}</TableCell>
                  <TableCell>{dateTime(t.pickupAt)}</TableCell>
                  <TableCell>{t.dropoffLocation?.name ?? t.dropoffAddress ?? "—"}</TableCell>
                  <TableCell>{dateTime(t.dropoffAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
