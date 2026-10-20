"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import type { RouterOutputs } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { CheckField, Field, FormDialog, SelectField, TextareaField } from "../../../../_components/form";
import { PhotoUploader, Thumbs } from "../../../../_components/inspections";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { ListStatusRow } from "../../../../_components/list-kit";

type Location = RouterOutputs["staff"]["settings"]["locationList"][number];
const s = (v: unknown) => (v == null ? "" : String(v));

/** Settings > Locations: every location, its contact details and whether it is active / offered on the public site. */
export function LocationsSettings() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.staff.settings.locationList.queryOptions());
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end"><LocationDialog /></div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Logo</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Vehicles</TableHead>
              <TableHead className="text-right">Online classes</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={9} loading={isLoading} empty={data?.length === 0} emptyText="No locations." />
            {data?.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.logoKey ? <Thumbs images={[{ id: l.id, s3Key: l.logoKey, fileName: "Logo", contentType: "image/png" }]} /> : null}</TableCell>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell>{l.code}</TableCell>
                <TableCell className="text-muted-foreground">{[l.address1, l.city, l.province, l.postal].filter(Boolean).join(", ")}</TableCell>
                <TableCell>{l.phone}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {l.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}
                    {l.displayOnline && <Badge variant="info">On website</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{l._count.vehiclesRental}</TableCell>
                <TableCell className="text-right tabular-nums">{l._count.vehicleTypes}</TableCell>
                <TableCell><LocationDialog l={l} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/** Edit location, or Add Location when `l` is left out; "Upload Logo" is the Logo field. */
function LocationDialog({ l: existing }: { l?: Location }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const l = (existing ?? { name: "", timeZone: "America/Vancouver", country: "CA", isActive: true, displayOnline: false, isOffsite: false }) as Location;
  const allowed = can(existing ? "LocationsEdit" : "LocationsAdd");
  return (
    <FormDialog
      wide
      title={existing ? "Edit location" : "Add Location"}
      trigger={
        existing ? (
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${l.name}`}><PencilIcon /></Button>
        ) : (
          <Button disabled={!allowed} title={allowed ? undefined : NO_PERMISSION}><PlusIcon /> Add Location</Button>
        )
      }
      onSubmit={async (v) => {
        const { images, ...data } = v;
        const id = existing
          ? (await client.staff.settings.locationSave.mutate({ id: existing.id, data: data as never })).id
          : (await client.staff.settings.locationCreate.mutate({ data: data as never })).id;
        const logo = (typeof images === "string" && images ? (JSON.parse(images) as { key: string }[]) : [])[0];
        if (logo) await client.staff.settings.locationLogo.mutate({ id, key: logo.key });
        await qc.invalidateQueries({ queryKey: trpc.staff.settings.locationList.queryKey() });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location name" name="name" required defaultValue={l.name} full hint="Shown to customers, e.g. “Richmond - 7780 River Road, V6X 1X7”." />
        <Field label="Location code" name="code" defaultValue={s(l.code)} />
        <Field label="Legal name" name="legalName" defaultValue={s(l.legalName)} hint="Heads the printed contract." />
        <Field label="GST number" name="gstNumber" defaultValue={s(l.gstNumber)} hint="Printed on the Customer Invoice." />
        <SelectField label="Time zone" name="timeZone" placeholder={false} defaultValue={l.timeZone} options={[{ value: "America/Vancouver", label: "Pacific time" }, { value: "America/Edmonton", label: "Mountain time" }]} />
        <Field label="Address" name="address1" defaultValue={s(l.address1)} />
        <Field label="Address 2" name="address2" defaultValue={s(l.address2)} />
        <Field label="City" name="city" defaultValue={s(l.city)} />
        <Field label="Province / state" name="province" defaultValue={s(l.province)} />
        <Field label="Postal / zip" name="postal" defaultValue={s(l.postal)} />
        <Field label="Country" name="country" defaultValue={s(l.country)} />
        <Field label="Phone" name="phone" type="tel" defaultValue={s(l.phone)} />
        <Field label="Fax" name="fax" type="tel" defaultValue={s(l.fax)} />
        <Field label="Email" name="email" type="email" defaultValue={s(l.email)} />
        <Field label="Toll free" name="tollFree" defaultValue={s(l.tollFree)} />
        <Field label="Closest intersection" name="closestIntersection" defaultValue={s(l.closestIntersection)} />
        <Field label="Closest airport" name="closestAirport" defaultValue={s(l.closestAirport)} />
        <Field label="Latitude" name="latitude" type="number" step="0.000001" defaultValue={s(l.latitude)} />
        <Field label="Longitude" name="longitude" type="number" step="0.000001" defaultValue={s(l.longitude)} />
        <Field label="Minimum age" name="minimumAge" type="number" min={0} defaultValue={s(l.minimumAge)} />
        <Field label="Under age" name="underAge" type="number" min={0} defaultValue={s(l.underAge)} hint="Renters younger than this pay the under-age charge." />
        <Field label="Convenience refuel ($/L)" name="refuelPrice" type="number" min={0} step="0.01" defaultValue={s(l.refuelPrice)} hint="Printed as “ReFuel: $…/L” on the contract." />
        <Field label="Diesel convenience refuel ($/L)" name="dieselRefuelPrice" type="number" min={0} step="0.01" defaultValue={s(l.dieselRefuelPrice)} />
        <Field label="Prepaid fuel ($/L)" name="prepaidFuelPrice" type="number" min={0} step="0.01" defaultValue={s(l.prepaidFuelPrice)} />
        <Field label="Diesel prepaid fuel ($/L)" name="dieselPrepaidFuelPrice" type="number" min={0} step="0.01" defaultValue={s(l.dieselPrepaidFuelPrice)} />
        <Field label="Location note" name="hoursNote" defaultValue={s(l.hoursNote)} full hint="Shown on the public Our Locations page, e.g. “24 hour key drop box”." />
        <TextareaField label="Memo" name="memo" rows={2} defaultValue={s(l.memo)} full />
        <div className="flex flex-wrap gap-6 sm:col-span-2">
          <CheckField label="Active" name="isActive" defaultChecked={l.isActive} />
          <CheckField label="Offered on the website" name="displayOnline" defaultChecked={l.displayOnline} />
          <CheckField label="Offsite (airport) location" name="isOffsite" defaultChecked={l.isOffsite} />
        </div>
        {existing?.logoKey && <div><span className="text-sm font-medium">Current logo</span><Thumbs images={[{ id: existing.id, s3Key: existing.logoKey, fileName: "Logo", contentType: "image/png" }]} /></div>}
        <PhotoUploader folder="logos" single label={existing?.logoKey ? "Replace logo" : "Logo"} />
      </div>
    </FormDialog>
  );
}
