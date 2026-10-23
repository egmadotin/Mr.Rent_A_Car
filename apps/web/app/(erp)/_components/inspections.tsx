"use client";

/* eslint-disable @next/next/no-img-element -- uploaded photos are served by /api/files (staff only), not next/image */
import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, ImagePlusIcon, Loader2Icon, MailIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, fromDateTimeLocal, toDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "./confirm-action";
import { Field, FormDialog, SelectField, TextareaField, errorMessage } from "./form";
import { NO_PERMISSION, useCan } from "./permissions";

/**
 * Vehicle Inspection, Reservation Inspection, Inspection Comparison and Customer Reported Damages — RentCentric's list
 * pages, plus the Add forms (with photos) that RentCentric leaves to its inspection / customer apps.
 */

type Upload = { key: string; fileName: string; contentType: string; sizeBytes: number };
type Img = { id: string; s3Key: string; fileName: string; contentType: string };
const fileUrl = (key: string) => `/api/files/${key}`;
const KIND_LABEL: Record<string, string> = { PICKUP: "Pickup", RETURN: "Return", OTHER: "Other" };
const FUEL = Array.from({ length: 17 }, (_, i) => ({ value: String(i), label: i === 16 ? "Full (16/16)" : i === 0 ? "Empty (0/16)" : `${i}/16` }));

/** Thumbnails of uploaded photos (PDFs as a file link); each opens full size in a new tab. */
export function Thumbs({ images, onDelete }: { images: Img[]; onDelete?: (id: string) => void }) {
  if (!images.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((i) => (
        <span key={i.id} className="group relative">
          <a href={fileUrl(i.s3Key)} target="_blank" rel="noreferrer" title={i.fileName} className="block size-14 overflow-hidden rounded border bg-muted">
            {i.contentType.startsWith("image/") && i.contentType !== "image/heic" ? (
              <img src={fileUrl(i.s3Key)} alt={i.fileName} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="grid size-full place-items-center text-muted-foreground"><FileTextIcon className="size-5" /></span>
            )}
          </a>
          {onDelete && (
            <button type="button" aria-label={`Remove ${i.fileName}`} onClick={() => onDelete(i.id)} className="absolute -top-1.5 -right-1.5 hidden rounded-full border bg-background p-0.5 text-destructive shadow group-hover:block">
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** Photo picker for a form: uploads each file to /api/files and submits the keys as the hidden `images` field. */
export function PhotoUploader({ folder, single, label = "Images", documents }: { folder: "inspections" | "damages" | "vehicles" | "logos"; single?: boolean; label?: string; /** also Word / Excel files */ documents?: boolean }) {
  const [files, setFiles] = React.useState<Upload[]>([]);
  const [busy, setBusy] = React.useState(0);
  async function add(list: FileList | null) {
    for (const f of Array.from(list ?? [])) {
      setBusy((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", f);
        body.append("folder", folder);
        const res = await fetch("/api/files", { method: "POST", body });
        const json = (await res.json()) as Upload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setFiles((x) => (single ? [json] : [...x, json]));
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }
  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm font-medium">{label}</span>
      <input type="hidden" name="images" value={JSON.stringify(files)} />
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f) => (
          <span key={f.key} className="flex items-center gap-1 rounded border px-2 py-1 text-xs">
            {f.fileName}
            <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))}><XIcon className="size-3" /></button>
          </span>
        ))}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          {busy ? <Loader2Icon className="size-4 animate-spin" /> : <ImagePlusIcon className="size-4" />} {single ? "Choose photo" : documents ? "Add files" : "Add photos"}
          <input type="file" accept={documents ? "image/*,application/pdf,.doc,.docx,.xls,.xlsx" : single ? "image/*" : "image/*,application/pdf"} multiple={!single} capture={documents ? undefined : "environment"} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{documents ? "PDF, Word, Excel or photos" : "JPG, PNG, WebP, HEIC or PDF"}, up to 15 MB each.</p>
    </div>
  );
}

const parseImages = (v: unknown): Upload[] => (typeof v === "string" && v ? (JSON.parse(v) as Upload[]) : []);

function useBookingOptions(vehicleId: string | null | undefined) {
  const trpc = useTRPC();
  const b = useQuery({ ...trpc.staff.inspections.bookings.queryOptions({ vehicleId: vehicleId ?? "" }), enabled: !!vehicleId }).data;
  return {
    rentals: (b?.rentals ?? []).map((r) => ({ value: r.id, label: `Rental# ${r.raNumber} — ${r.customer.firstName} ${r.customer.lastName}` })),
    reservations: (b?.reservations ?? []).map((r) => ({ value: r.id, label: `Res# ${r.number} — ${r.firstName} ${r.lastName}` })),
  };
}

/**
 * Vehicle Inspection list (Admin, Date, Images) for a vehicle, a reservation (Reservation Inspection) or a rental,
 * with Add Inspection. `vehicleId` is the vehicle inspected (a reservation with no vehicle assigned can't be inspected yet).
 */
export function InspectionsPanel({ title = "Vehicle Inspection", vehicleId, reservationId, rentalId, empty = "No Records Found" }: { title?: string; vehicleId?: string | null; reservationId?: string; rentalId?: string; empty?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const where = { vehicleId: reservationId || rentalId ? undefined : (vehicleId ?? undefined), reservationId, rentalId };
  const rows = useQuery(trpc.staff.inspections.list.queryOptions(where)).data;
  const opts = useBookingOptions(vehicleId);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [emailing, setEmailing] = React.useState<{ id: string; to: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.inspections.pathKey() });

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
        {vehicleId ? (
          <FormDialog
            title="Add Inspection"
            wide
            trigger={<Button size="sm"><PlusIcon /> Add Inspection</Button>}
            onSubmit={async (v) => {
              await client.staff.inspections.save.mutate({
                vehicleId, kind: v.kind as "PICKUP", at: fromDateTimeLocal(String(v.at)), rentalId: (v.rentalId as string) || rentalId || null,
                reservationId: (v.reservationId as string) || reservationId || null, odometer: v.odometer as never, fuel: v.fuel as never, memo: v.memo as string, images: parseImages(v.images),
              });
              await refresh();
            }}
          >
            <SelectField label="Inspection" name="kind" options={[{ value: "PICKUP", label: "Pickup (check-out)" }, { value: "RETURN", label: "Return (check-in)" }, { value: "OTHER", label: "Other" }]} placeholder={false} defaultValue={rentalId ? "RETURN" : reservationId ? "PICKUP" : "OTHER"} />
            <Field label="Date" name="at" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
            {!rentalId && !reservationId && (
              <>
                <SelectField label="Rental #" name="rentalId" options={opts.rentals} placeholder="" />
                <SelectField label="Reservation #" name="reservationId" options={opts.reservations} placeholder="" />
              </>
            )}
            <Field label="Odometer" name="odometer" type="number" min={0} />
            <SelectField label="Fuel" name="fuel" options={FUEL} placeholder="" />
            <TextareaField label="Memo" name="memo" rows={2} />
            <PhotoUploader folder="inspections" />
          </FormDialog>
        ) : (
          <Button size="sm" disabled title="Assign a vehicle first"><PlusIcon /> Add Inspection</Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {!rows ? null : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead><TableHead>Date</TableHead><TableHead>Inspection</TableHead>
                {!vehicleId || reservationId || rentalId ? <TableHead>Vehicle</TableHead> : <TableHead>Rental / Reservation</TableHead>}
                <TableHead>Odometer</TableHead><TableHead>Images</TableHead><TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="align-top">{r.admin || "—"}</TableCell>
                  <TableCell className="align-top">{dateTime(r.at)}</TableCell>
                  <TableCell className="align-top">{KIND_LABEL[r.kind]}{r.memo && <p className="text-xs text-muted-foreground">{r.memo}</p>}</TableCell>
                  <TableCell className="align-top">
                    {!vehicleId || reservationId || rentalId ? (
                      <Link className="text-primary hover:underline" href={`/admin/vehicles/${r.vehicle.id}`}>{r.vehicle.assignedId}</Link>
                    ) : (
                      <div className="space-y-0.5">
                        {r.rental && <Link className="block text-primary hover:underline" href={`/admin/rentals/${r.rental.id}`}>Rental# {r.rental.raNumber}</Link>}
                        {r.reservation && <Link className="block text-primary hover:underline" href={`/admin/reservations/${r.reservation.id}`}>Res# {r.reservation.number}</Link>}
                        {!r.rental && !r.reservation && "—"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top tabular-nums">{r.odometer?.toLocaleString() ?? "—"}</TableCell>
                  <TableCell className="align-top">
                    <Thumbs images={r.images} onDelete={(id) => client.staff.inspections.deleteImage.mutate({ id }).then(refresh, (e) => toast.error(errorMessage(e)))} />
                  </TableCell>
                  <TableCell className="flex align-top">
                    <Button size="icon-sm" variant="ghost" aria-label="Email inspection to the customer" onClick={() => setEmailing({ id: r.id, to: r.rental?.customer.email ?? r.reservation?.email ?? "" })}>
                      <MailIcon />
                    </Button>
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete inspection" disabled={!can("DamagesEdit")} title={can("DamagesEdit") ? undefined : NO_PERMISSION} onClick={() => setDeleting(r.id)}>
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {emailing && (
          <FormDialog
            open
            onOpenChange={(o) => !o && setEmailing(null)}
            title="Email inspection"
            description="Sends the Inspection Email (Settings) with this inspection's details and photos attached."
            submitLabel="Send"
            onSubmit={async (v) => {
              await client.staff.inspections.email.mutate({ id: emailing.id, to: String(v.to ?? "") });
            }}
          >
            <Field label="To" name="to" type="email" required defaultValue={emailing.to} full />
          </FormDialog>
        )}
        <ConfirmAction
          open={deleting !== null}
          onOpenChange={(o) => !o && setDeleting(null)}
          destructive
          title="Delete this inspection?"
          description="The inspection and its photos are removed."
          confirmLabel="Delete"
          onConfirm={() => client.staff.inspections.delete.mutate({ id: deleting! }).then(refresh, (e) => toast.error(errorMessage(e)))}
        />
      </CardContent>
    </Card>
  );
}

/** Inspection Comparison (Customer, Rental #, Pickup Date, Return Date, Images): pickup vs return photos per rental. */
export function InspectionComparisonPanel({ vehicleId, rentalId }: { vehicleId?: string; rentalId?: string }) {
  const trpc = useTRPC();
  const rows = useQuery(trpc.staff.inspections.comparison.queryOptions({ vehicleId, rentalId })).data;
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="text-base font-bold tracking-tight">Inspection Comparison</CardTitle></CardHeader>
      <CardContent className="px-0">
        {!rows ? null : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No Records Found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Customer</TableHead><TableHead>Rental #</TableHead><TableHead>Pickup Date</TableHead><TableHead>Return Date</TableHead><TableHead>Images</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rentalId}>
                  <TableCell className="align-top">{r.customer}</TableCell>
                  <TableCell className="align-top"><Link className="text-primary hover:underline" href={`/admin/rentals/${r.rentalId}`}>{r.raNumber}</Link></TableCell>
                  <TableCell className="align-top">{dateTime(r.pickup)}</TableCell>
                  <TableCell className="align-top">{dateTime(r.return)}</TableCell>
                  <TableCell className="align-top">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Pickup</p><Thumbs images={r.pickupImages} /></div>
                      <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Return</p><Thumbs images={r.returnImages} /></div>
                      {r.otherImages.length > 0 && <div className="md:col-span-2"><p className="mb-1 text-xs font-semibold text-muted-foreground">Other</p><Thumbs images={r.otherImages} /></div>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Customer Reported Damages (Date Entered, Customer, Description, Reservation #, Rental #, Condition, Location, Images, Delete). */
export function ReportedDamagesPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const rows = useQuery(trpc.staff.inspections.reportedDamages.queryOptions({ vehicleId })).data;
  const opts = useBookingOptions(vehicleId);
  const active = (xs: { id: string; name: string; isActive: boolean }[] | undefined) => (xs ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: x.name }));
  const locations = active(useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "DAMAGE_LOCATION" })).data);
  const conditions = active(useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "DAMAGE_CONDITION" })).data);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.inspections.pathKey() });

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="text-base font-bold tracking-tight">Customer Reported Damages</CardTitle>
        {can("DamagesAdd") ? (
          <FormDialog
            title="Add Customer Reported Damage"
            wide
            trigger={<Button size="sm"><PlusIcon /> Add New</Button>}
            onSubmit={async (v) => {
              await client.staff.inspections.saveReportedDamage.mutate({
                vehicleId, rentalId: (v.rentalId as string) || null, reservationId: (v.reservationId as string) || null, description: String(v.description ?? ""),
                conditionId: (v.conditionId as string) || null, locationId: (v.locationId as string) || null, images: parseImages(v.images),
              });
              await refresh();
            }}
          >
            <SelectField label="Rental #" name="rentalId" options={opts.rentals} placeholder="" />
            <SelectField label="Reservation #" name="reservationId" options={opts.reservations} placeholder="" />
            <SelectField label="Condition" name="conditionId" options={conditions} placeholder="Please select" />
            <SelectField label="Location" name="locationId" options={locations} placeholder="Please select" />
            <TextareaField label="Description" name="description" rows={3} required />
            <PhotoUploader folder="damages" />
          </FormDialog>
        ) : (
          <Button size="sm" disabled title={NO_PERMISSION}><PlusIcon /> Add New</Button>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {!rows ? null : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No Records Found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Entered</TableHead><TableHead>Customer</TableHead><TableHead>Description</TableHead><TableHead>Reservation #</TableHead><TableHead>Rental #</TableHead>
                <TableHead>Condition</TableHead><TableHead>Location</TableHead><TableHead>Images</TableHead><TableHead className="w-10">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="align-top">{dateTime(r.createdAt)}</TableCell>
                  <TableCell className="align-top">{r.customer ? <Link className="text-primary hover:underline" href={`/admin/customers/${r.customer.id}`}>{r.customer.firstName} {r.customer.lastName}</Link> : "—"}</TableCell>
                  <TableCell className="max-w-72 align-top whitespace-pre-wrap">{r.description}</TableCell>
                  <TableCell className="align-top">{r.reservation ? <Link className="text-primary hover:underline" href={`/admin/reservations/${r.reservation.id}`}>{r.reservation.number}</Link> : "—"}</TableCell>
                  <TableCell className="align-top">{r.rental ? <Link className="text-primary hover:underline" href={`/admin/rentals/${r.rental.id}`}>{r.rental.raNumber}</Link> : "—"}</TableCell>
                  <TableCell className="align-top">{r.condition?.name ?? "—"}</TableCell>
                  <TableCell className="align-top">{r.location?.name ?? "—"}</TableCell>
                  <TableCell className="align-top"><Thumbs images={r.images} onDelete={(id) => client.staff.inspections.deleteImage.mutate({ id }).then(refresh, (e) => toast.error(errorMessage(e)))} /></TableCell>
                  <TableCell className="align-top">
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Delete reported damage" disabled={!can("DamagesEdit")} title={can("DamagesEdit") ? undefined : NO_PERMISSION} onClick={() => setDeleting(r.id)}>
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ConfirmAction
          open={deleting !== null}
          onOpenChange={(o) => !o && setDeleting(null)}
          destructive
          title="Delete this reported damage?"
          description="The record and its photos are removed."
          confirmLabel="Delete"
          onConfirm={() => client.staff.inspections.deleteReportedDamage.mutate({ id: deleting! }).then(refresh, (e) => toast.error(errorMessage(e)))}
        />
      </CardContent>
    </Card>
  );
}
