"use client";

/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { FormAlert } from "../../../../_components/booking-kit";
import { CheckField, Field, FormErrorsContext, SelectField, TextareaField, errorMessage, fieldErrorsOf, formToObject } from "../../../../_components/form";
import { ListStatusRow } from "../../../../_components/list-kit";
import { LinkRow } from "../../../../_components/link-row";

/** Settings > Vehicle Setup > Vehicle Types: every class and the locations that offer it. */
export function VehicleTypesList() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.staff.settings.vehicleTypeList.queryOptions());
  const [q, setQ] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const locations = [...new Map((data ?? []).flatMap((t) => t.locations.map((l) => [l.location.id, l.location.name] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const shown = (data ?? []).filter(
    (t) => (!q.trim() || `${t.name} ${t.code ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) && (!locationId || t.locations.some((l) => l.location.id === locationId)),
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Class name or code…" className="pl-8" aria-label="Search vehicle types" />
        </div>
        <NativeSelect className="w-72" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
          <option value="">All locations</option>
          {locations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </NativeSelect>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead>Vehicle type</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Seats</TableHead>
              <TableHead className="text-right">Doors</TableHead>
              <TableHead>Offered at</TableHead>
              <TableHead className="text-right">Vehicles</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={8} loading={isLoading} empty={!isLoading && shown.length === 0} emptyText="No vehicle types match." />
            {shown.map((t) => (
              <LinkRow key={t.id} href={`/admin/settings/vehicle-types/${t.id}`}>
                <TableCell>{t.imageKey ? <img src={t.imageKey} alt="" className="h-8 w-14 rounded bg-white object-contain" /> : null}</TableCell>
                <TableCell><Link href={`/admin/settings/vehicle-types/${t.id}`} className="font-medium text-primary hover:underline">{t.name}</Link></TableCell>
                <TableCell>{t.code}</TableCell>
                <TableCell className="text-right tabular-nums">{t.seats}</TableCell>
                <TableCell className="text-right tabular-nums">{t.doors}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.locations.length} location{t.locations.length === 1 ? "" : "s"} · {t.locations.filter((l) => l.displayOnline).length} online
                </TableCell>
                <TableCell className="text-right tabular-nums">{t._count.vehicles}</TableCell>
                <TableCell>{t.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="muted">Inactive</Badge>}</TableCell>
              </LinkRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

type LocRow = { locationId: string; name: string; isActive: boolean; offered: boolean; displayOnline: boolean; description: string; sortOrder: string };

/** Edit one class (VehicleTypesModify.aspx) and how each location offers it. */
export function VehicleTypeForm({ id }: { id: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const { data } = useQuery(trpc.staff.settings.vehicleTypeGet.queryOptions({ id }));
  const [rows, setRows] = React.useState<LocRow[] | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!data || rows) return;
    setRows(
      data.locations.map((l) => {
        const r = data.type.locations.find((x) => x.locationId === l.id);
        return { locationId: l.id, name: l.name, isActive: l.isActive, offered: !!r?.isActive, displayOnline: !!r?.displayOnline, description: r?.description ?? "", sortOrder: String(r?.sortOrder ?? 0) };
      }),
    );
  }, [data, rows]);

  if (!data || !rows) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const t = data.type;
  const s = (v: unknown) => (v == null ? "" : String(v));
  const day = (v: Date | string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const patch = (i: number, p: Partial<LocRow>) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    const v = formToObject(e.currentTarget);
    try {
      await client.staff.settings.vehicleTypeSave.mutate({
        id,
        data: { ...(v as object), locations: rows!.map(({ locationId, offered, displayOnline, description, sortOrder }) => ({ locationId, offered, displayOnline: offered && displayOnline, description, sortOrder })) } as never,
      });
      toast.success(`${v.name} saved`);
      router.push("/admin/settings/vehicle-types");
    } catch (err) {
      const fe = Object.fromEntries(Object.entries(fieldErrorsOf(err)).map(([k, val]) => [k.replace(/^data\./, ""), val]));
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className="space-y-6 p-4 md:p-6">
        <FormAlert message={formError} />
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle type</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Description" name="name" required defaultValue={t.name} hint="The class name customers see." />
            <Field label="Vehicle type code" name="code" defaultValue={s(t.code)} />
            <Field label="SIPP codes" name="sippCode" defaultValue={s(t.sippCode)} />
            <SelectField label="Seats" name="seats" defaultValue={s(t.seats)} options={Array.from({ length: 16 }, (_, i) => String(i + 1))} placeholder="—" />
            <SelectField label="Doors" name="doors" defaultValue={s(t.doors)} options={["0", "2", "3", "4", "5"]} placeholder="—" />
            <SelectField label="Transmission" name="transmission" defaultValue={s(t.transmission)} options={["Automatic", "Manual"]} placeholder="—" />
            <Field label="Small bags" name="smallBags" type="number" min={0} defaultValue={s(t.smallBags)} />
            <Field label="Large bags" name="largeBags" type="number" min={0} defaultValue={s(t.largeBags)} />
            <Field label="Minimum age" name="minimumAge" type="number" min={0} defaultValue={s(t.minimumAge)} />
            <Field label="Deposit" name="deposit" type="number" step="0.01" min={0} defaultValue={s(t.deposit)} />
            <SelectField label="Deposit type" name="depositType" defaultValue={s(t.depositType)} options={["Flat", "Percent"]} placeholder="—" />
            <Field label="Photo" name="imageKey" defaultValue={s(t.imageKey)} hint="Path of the class photo, e.g. /legacy/vehicle-types/…" />
            <Field label="Effective date" name="effectiveDate" type="date" defaultValue={day(t.effectiveDate)} />
            <Field label="End date" name="endDate" type="date" defaultValue={day(t.endDate)} />
            <Field label="Vehicle spec URL" name="specUrl" defaultValue={s(t.specUrl)} />
            <Field label="YouTube video URL" name="videoUrl" defaultValue={s(t.videoUrl)} />
            <TextareaField label="Memo (“… or Similar”)" name="description" rows={2} defaultValue={s(t.description)} full />
            <div className="flex flex-wrap gap-6 sm:col-span-2 xl:col-span-3">
              <CheckField label="Active" name="isActive" defaultChecked={t.isActive} />
              <CheckField label="Web customer (default)" name="displayOnline" defaultChecked={t.displayOnline} />
              <CheckField label="Always available" name="alwaysAvailable" defaultChecked={t.alwaysAvailable} />
              <CheckField label="Air conditioner" name="airConditioner" defaultChecked={t.airConditioner} />
              <CheckField label="Deposit required at reservation" name="depositRequiredAtReservation" defaultChecked={t.depositRequiredAtReservation} />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="flex-col items-start gap-1 pb-4">
            <CardTitle className="text-base">Locations</CardTitle>
            <CardDescription>Where this class is offered, and how each location shows it on the public Fleet page (lower order = shown first).</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="w-24">Offered</TableHead>
                <TableHead className="w-24">Online</TableHead>
                <TableHead>Memo at this location</TableHead>
                <TableHead className="w-24">Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.locationId}>
                  <TableCell>
                    {r.name} {!r.isActive && <Badge variant="muted" className="ml-1">Inactive</Badge>}
                  </TableCell>
                  <TableCell><Checkbox checked={r.offered} onChange={(e) => patch(i, { offered: e.target.checked })} aria-label={`Offered at ${r.name}`} /></TableCell>
                  <TableCell><Checkbox checked={r.offered && r.displayOnline} disabled={!r.offered} onChange={(e) => patch(i, { displayOnline: e.target.checked })} aria-label={`Online at ${r.name}`} /></TableCell>
                  <TableCell><Input value={r.description} disabled={!r.offered} onChange={(e) => patch(i, { description: e.target.value })} placeholder={t.description ?? ""} aria-label={`Memo at ${r.name}`} /></TableCell>
                  <TableCell><Input type="number" className="w-20" value={r.sortOrder} disabled={!r.offered} onChange={(e) => patch(i, { sortOrder: e.target.value })} aria-label={`Order at ${r.name}`} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button type="button" variant="outline" asChild><Link href="/admin/settings/vehicle-types">Cancel</Link></Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Save changes</Button>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
