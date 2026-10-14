"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { money } from "@mrac/ui/lib/format";
import { CheckField, Field, FormDialog, SelectField } from "../../../../_components/form";

const md = (v: string | Date) => new Date(v).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const toInput = (v: string | Date) => new Date(v).toISOString().slice(0, 10);

export function SeasonsTaxes({ view }: { view: "seasons" | "taxes" }) {
  return view === "seasons" ? <Seasons /> : <Taxes />;
}

function Seasons() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const { data } = useQuery(trpc.staff.settings.seasonList.queryOptions());
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.settings.seasonList.queryKey() });
  const dialog = (s?: { id: string; name: string; startDate: string | Date; endDate: string | Date }) => (
    <FormDialog
      title={s ? "Edit season" : "New season"}
      trigger={s ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`}><PencilIcon /></Button> : <Button><PlusIcon /> New season</Button>}
      onSubmit={async (v) => {
        await client.staff.settings.seasonSave.mutate({ id: s?.id, name: v.name as string, startDate: new Date(`${v.startDate}T00:00:00Z`), endDate: new Date(`${v.endDate}T00:00:00Z`) });
        await refresh();
      }}
    >
      <Field label="Name" name="name" required defaultValue={s?.name} />
      <Field label="Start" name="startDate" type="date" required defaultValue={s ? toInput(s.startDate) : ""} />
      <Field label="End" name="endDate" type="date" required defaultValue={s ? toInput(s.endDate) : ""} />
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Season</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Rates</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{md(s.startDate)}</TableCell>
                <TableCell>{md(s.endDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{s._count.rates}</TableCell>
                <TableCell>{dialog(s)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Taxes() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const { data } = useQuery(trpc.staff.settings.taxList.queryOptions());
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.settings.taxList.queryKey() });
  type T = NonNullable<typeof data>[number];
  const dialog = (t?: T) => (
    <FormDialog
      title={t ? "Edit tax" : "New tax"}
      wide
      trigger={t ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`}><PencilIcon /></Button> : <Button><PlusIcon /> New tax</Button>}
      onSubmit={async (v) => {
        await client.staff.settings.taxSave.mutate({
          id: t?.id,
          name: v.name as string,
          kind: v.kind as "PERCENT",
          value: Number(v.value),
          perDay: Boolean(v.perDay),
          isActive: Boolean(v.isActive),
          locationIds: (v.locationIds as string[]) ?? [],
        });
        await refresh();
      }}
    >
      <Field label="Name" name="name" required defaultValue={t?.name} />
      <SelectField label="Type" name="kind" placeholder={false} options={[{ value: "PERCENT", label: "Percent %" }, { value: "AMOUNT", label: "Fixed amount $" }]} defaultValue={t?.kind ?? "PERCENT"} />
      <Field label="Value" name="value" type="number" step="0.001" required defaultValue={t ? String(t.value) : ""} />
      <div className="flex items-end gap-6">
        <CheckField label="Per day" name="perDay" defaultChecked={t?.perDay} />
        <CheckField label="Active" name="isActive" defaultChecked={t?.isActive ?? true} />
      </div>
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Applies at</legend>
        {lookups?.locations.filter((l) => l.isActive).map((l) => (
          <CheckField key={l.id} label={l.name} name="locationIds" value={l.id} data-multi="1" defaultChecked={t?.locations.some((x) => x.location.id === l.id)} />
        ))}
      </fieldset>
    </FormDialog>
  );
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">{dialog()}</div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Tax</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Per day</TableHead><TableHead>Locations</TableHead><TableHead>Active</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
          <TableBody>
            {data?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-right tabular-nums">{t.kind === "PERCENT" ? `${Number(t.value)}%` : money(t.value)}</TableCell>
                <TableCell>{t.perDay ? "Yes" : ""}</TableCell>
                <TableCell className="text-muted-foreground">{t.locations.map((l) => l.location.name).join(", ") || "—"}</TableCell>
                <TableCell>{t.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell>{dialog(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
