"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, TextareaField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

const PARKING = ["Private", "Parking lot", "On-Street"].map((p) => ({ value: p, label: p }));

/**
 * Settings > Offsite Locations (OffsiteLocationsMain.aspx / OffsiteLocationsModify.aspx): a location's extra pick-up /
 * return points — Location Name, Contact Name, Phone, Address, Active — with RentCentric's form fields.
 */
export function OffsiteSettings({ initialLocationId }: { initialLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const filters = useQuery(trpc.staff.reports.filters.queryOptions()).data;
  const taxes = useQuery(trpc.staff.settings.taxList.queryOptions()).data ?? [];
  const locations = filters?.locations ?? [];
  const [locationId, setLocationId] = React.useState(initialLocationId ?? "");
  const loc = locationId || locations[0]?.id || "";
  const { data } = useQuery({ ...trpc.staff.setup.offsiteList.queryOptions({ locationId: loc }), enabled: !!loc });
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.offsiteList.queryKey() });
  const editable = can("LocationsEdit");
  type O = NonNullable<typeof data>[number];

  const dialog = (x?: O) => (
    <FormDialog
      title={x ? `Edit ${x.name}` : "New Offsite Location"}
      wide
      trigger={x
        ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} disabled={!editable}><PencilIcon /></Button>
        : <Button disabled={!editable || !loc} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Offsite Location</Button>}
      onSubmit={async (v) => {
        await client.staff.setup.offsiteSave.mutate({
          id: x?.id, locationId: loc, name: String(v.name ?? ""), parkingSymbol: v.parkingSymbol as string, code: v.code as string, contactName: v.contactName as string,
          address: v.address as string, city: v.city as string, province: v.province as string, country: v.country as string, postal: v.postal as string,
          phone: v.phone as string, fax: v.fax as string, email: (v.email as string) ?? "", regionId: v.regionId as string,
          latitude: v.latitude as never, longitude: v.longitude as never, parkingType: v.parkingType as string, parkingExplanation: v.parkingExplanation as string,
          memo: v.memo as string, isActive: !!v.isActive, useOneWay: !!v.useOneWay, webCustomer: !!v.webCustomer, isPrivateProperty: !!v.isPrivateProperty,
          taxIds: (v.taxIds as string[] | undefined) ?? [],
          boundary: (x?.boundary as [number, number][] | null) ?? [],
        });
        toast.success("Offsite location saved");
        await refresh();
      }}
    >
      <Field label="Parking Symbol" name="parkingSymbol" defaultValue={x?.parkingSymbol ?? ""} hint="Shown before the name, e.g. (O)" />
      <Field label="Location Name" name="name" required defaultValue={x?.name} />
      <Field label="Location Code" name="code" defaultValue={x?.code ?? ""} />
      <Field label="Contact Name" name="contactName" defaultValue={x?.contactName ?? ""} />
      <Field label="Address" name="address" defaultValue={x?.address ?? ""} />
      <Field label="City" name="city" defaultValue={x?.city ?? ""} />
      <Field label="Province / State" name="province" defaultValue={x?.province ?? ""} />
      <Field label="Country" name="country" defaultValue={x?.country ?? "Canada"} />
      <Field label="Zip / Postal" name="postal" defaultValue={x?.postal ?? ""} />
      <Field label="Phone" name="phone" type="tel" defaultValue={x?.phone ?? ""} />
      <Field label="Fax" name="fax" type="tel" defaultValue={x?.fax ?? ""} />
      <Field label="Email" name="email" type="email" defaultValue={x?.email ?? ""} />
      <SelectField label="Region" name="regionId" options={(filters?.regions ?? []).map((r) => ({ value: r.id, label: r.name }))} placeholder="—" defaultValue={x?.regionId ?? ""} />
      <SelectField label="Parking" name="parkingType" options={PARKING} placeholder="—" defaultValue={x?.parkingType ?? ""} />
      <Field label="Latitude" name="latitude" type="number" step="any" defaultValue={x?.latitude != null ? String(x.latitude) : ""} />
      <Field label="Longitude" name="longitude" type="number" step="any" defaultValue={x?.longitude != null ? String(x.longitude) : ""} />
      <TextareaField label="Parking Explanation" name="parkingExplanation" rows={2} defaultValue={x?.parkingExplanation ?? ""} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={x?.memo ?? ""} />
      <div className="space-y-1.5">
        <CheckField label="Active" name="isActive" defaultChecked={x?.isActive ?? true} />
        <CheckField label="Use One Way" name="useOneWay" defaultChecked={x?.useOneWay ?? false} />
        <CheckField label="Enable Online Booking for this Location" name="webCustomer" defaultChecked={x?.webCustomer ?? false} />
        <CheckField label="Is Private Property" name="isPrivateProperty" defaultChecked={x?.isPrivateProperty ?? false} />
      </div>
      <fieldset className="space-y-1 sm:col-span-2">
        <legend className="text-sm font-medium">Taxes</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {taxes.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="taxIds" value={t.id} data-multi="1" defaultChecked={x?.taxIds.includes(t.id)} className="size-4" /> {t.name}
            </label>
          ))}
        </div>
      </fieldset>
    </FormDialog>
  );

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="off-loc">Location</Label>
          <NativeSelect id="off-loc" value={loc} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </div>
        {dialog()}
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Location Name</TableHead><TableHead>Contact Name</TableHead><TableHead>Phone</TableHead><TableHead>Address</TableHead><TableHead>Active</TableHead><TableHead className="w-20" /></TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.parkingSymbol ? `${x.parkingSymbol} ` : ""}{x.name}</TableCell>
                <TableCell>{x.contactName}</TableCell>
                <TableCell>{x.phone}</TableCell>
                <TableCell>{[x.address, x.city].filter(Boolean).join(", ")}</TableCell>
                <TableCell>{x.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="flex justify-end">
                  {dialog(x)}
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${x.name}`} disabled={!editable} title={editable ? undefined : NO_PERMISSION} onClick={() => setDeleting({ id: x.id, name: x.name })}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="The offsite location is removed. To keep it on record, make it inactive instead."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.setup.offsiteDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
