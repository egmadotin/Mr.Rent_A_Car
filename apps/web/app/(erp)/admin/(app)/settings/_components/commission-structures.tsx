"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Commission Structures (CommissionStructureMain / CommissionStructureModify2): Name, Location, then per charge the
 * Reservation / Open / Close / Walkin commission (amount + Daily / % / $). Agents get structures on Settings › Users;
 * the Commissions report adds up what they earn.
 */

const ROLES = [["res", "Reservation"], ["open", "Open"], ["close", "Close"], ["walkin", "Walkin"]] as const;
type Role = (typeof ROLES)[number][0];
type Cell = { amount: string; type: "DAILY" | "PERCENT" | "AMOUNT" };
type Grid = Record<string, Partial<Record<Role, Cell>>>;
type Structure = { id: string; name: string; locationId: string | null; location: { name: string } | null; rules: unknown };

export function CommissionStructures() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery(trpc.staff.setup.commissionStructures.queryOptions());
  const [editing, setEditing] = React.useState<Structure | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Structure | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.setup.commissionStructures.queryKey() });
  const editable = can("Settings");
  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">
        <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION} onClick={() => setEditing("new")}><PlusIcon /> New Commission Structure</Button>
      </div>
      <Card className="max-w-3xl gap-0 py-0">
        <Table>
          <TableHeader><TableRow><TableHead>Commission Structure Name</TableHead><TableHead>Location</TableHead><TableHead className="w-20">Delete</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
            {data?.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell>{x.location?.name ?? "All"}</TableCell>
                <TableCell className="flex justify-end">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${x.name}`} disabled={!editable} onClick={() => setEditing(x as Structure)}><PencilIcon /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${x.name}`} disabled={!editable} onClick={() => setDeleting(x as Structure)}><Trash2Icon /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editing && <StructureDialog key={editing === "new" ? "new" : editing.id} structure={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Users with this structure must have it unticked first."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.setup.commissionStructureDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}

function StructureDialog({ structure, onClose, onSaved }: { structure: Structure | null; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const items = useQuery(trpc.staff.setup.commissionItems.queryOptions()).data ?? [];
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const [name, setName] = React.useState(structure?.name ?? "");
  const [locationId, setLocationId] = React.useState(structure?.locationId ?? "");
  const [grid, setGrid] = React.useState<Grid>(() => {
    const r = (structure?.rules ?? {}) as Record<string, Partial<Record<Role, { amount: number; type: Cell["type"] }>>>;
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([role, c]) => [role, { amount: String(c!.amount), type: c!.type }]))]));
  });
  const [saving, setSaving] = React.useState(false);
  const cell = (item: string, role: Role): Cell => grid[item]?.[role] ?? { amount: "", type: "DAILY" };
  const set = (item: string, role: Role, c: Partial<Cell>) => setGrid((g) => ({ ...g, [item]: { ...g[item], [role]: { ...cell(item, role), ...c } } }));

  async function save() {
    if (!name.trim()) return toast.error("Commission Structure Name is required.");
    const rules: Record<string, Partial<Record<Role, { amount: number; type: Cell["type"] }>>> = {};
    for (const [item, roles] of Object.entries(grid))
      for (const [role, c] of Object.entries(roles))
        if (c && c.amount !== "" && Number(c.amount) > 0) (rules[item] ??= {})[role as Role] = { amount: Number(c.amount), type: c.type };
    setSaving(true);
    try {
      await client.staff.setup.commissionStructureSave.mutate({ id: structure?.id, name, locationId: locationId || null, rules });
      await onSaved();
      toast.success("Commission structure saved");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>{structure ? `Edit ${structure.name}` : "New Commission Structure"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="cs-name">Commission Structure Name</Label><Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-loc">Location</Label>
            <NativeSelect id="cs-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </NativeSelect>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="px-2 py-1.5 text-left font-medium" />{ROLES.map(([k, l]) => <th key={k} className="px-2 py-1.5 text-left font-medium">{l}</th>)}</tr>
            </thead>
            <tbody>
              {items.flatMap((g) => [
                ...(g.group ? [<tr key={`g-${g.group}`} className="border-t bg-muted/30"><td colSpan={5} className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">{g.group}:</td></tr>] : []),
                ...g.items.map(([key, label]) => (
                  <tr key={key} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">{label}</td>
                    {ROLES.map(([role]) => {
                      const c = cell(key, role);
                      return (
                        <td key={role} className="px-1 py-1">
                          <div className="flex gap-1">
                            <Input aria-label={`${label} ${role} amount`} type="number" min={0} step="0.01" className="h-8 w-20" value={c.amount} onChange={(e) => set(key, role, { amount: e.target.value })} />
                            <NativeSelect aria-label={`${label} ${role} type`} className="h-8 w-20" value={c.type} onChange={(e) => set(key, role, { type: e.target.value as Cell["type"] })}>
                              <option value="DAILY">Daily</option>
                              <option value="PERCENT">%</option>
                              <option value="AMOUNT">$</option>
                            </NativeSelect>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
