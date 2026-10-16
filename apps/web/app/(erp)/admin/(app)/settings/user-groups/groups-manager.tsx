"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, PlusCircleIcon, SaveIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

type G = { id?: string; name: string; isActive: boolean; locationId: string; maxDiscountType: "PERCENT" | "AMOUNT"; maxDiscountValue: string; permissions: string[] };
const EMPTY: G = { name: "", isActive: true, locationId: "", maxDiscountType: "PERCENT", maxDiscountValue: "", permissions: [] };

/** Group list on the left; the selected group's Description, Location, Max Discount, Active and permission ticks. */
export function GroupsManager() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const groups = useQuery(trpc.staff.users.groups.queryOptions());
  const sections = useQuery(trpc.staff.users.catalog.queryOptions()).data ?? [];
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const [g, setG] = React.useState<G | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = React.useState(false);
  const editable = can("AdminsEdit");
  if (groups.error) return <p className="p-6 text-sm text-destructive">{groups.error.message}</p>;

  const pick = (id: string) => {
    const x = groups.data!.find((y) => y.id === id)!;
    setErrors({});
    setG({ id: x.id, name: x.name, isActive: x.isActive, locationId: x.locationId ?? "", maxDiscountType: x.maxDiscountType ?? "PERCENT", maxDiscountValue: x.maxDiscountValue == null ? "" : String(Number(x.maxDiscountValue)), permissions: x.permissions });
  };
  const all = sections.flatMap((s) => s.items.map(([k]) => k));
  const toggle = (k: string, on: boolean) => setG((s) => (s ? { ...s, permissions: on ? [...new Set([...s.permissions, k])] : s.permissions.filter((p) => p !== k) } : s));

  async function save() {
    if (!g) return;
    setSaving(true);
    setErrors({});
    try {
      const r = await client.staff.users.saveGroup.mutate({ ...g, locationId: g.locationId || undefined, maxDiscountValue: g.maxDiscountValue as never });
      toast.success("User group saved");
      await groups.refetch();
      setG((s) => (s ? { ...s, id: r.id } : s));
    } catch (e) {
      setErrors(fieldErrorsOf(e));
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormErrorsContext.Provider value={errors}>
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="gap-2 self-start">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Groups</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setG({ ...EMPTY })} disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusCircleIcon /> Add New</Button>
          </CardHeader>
          <CardContent className="px-2">
            <ul>
              {(groups.data ?? []).map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => pick(x.id)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${g?.id === x.id ? "bg-accent font-medium" : ""}`}>
                    <span>{x.name}</span>
                    <span className="flex items-center gap-1">
                      {!x.isActive && <Badge variant="muted">Inactive</Badge>}
                      <span className="text-xs text-muted-foreground">{x._count.users} users</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {!g ? (
          <p className="text-sm text-muted-foreground">Choose a group to see or change its permissions.</p>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <F label="Description" name="name" required><Input id="name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} disabled={!editable} /></F>
                <F label="Location" name="locationId">
                  <NativeSelect id="locationId" value={g.locationId} onChange={(e) => setG({ ...g, locationId: e.target.value })} disabled={!editable}>
                    <option value="">ALL</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </NativeSelect>
                </F>
                <F label="Max Discount" name="maxDiscountValue">
                  <div className="flex gap-2">
                    <NativeSelect className="w-20" value={g.maxDiscountType} onChange={(e) => setG({ ...g, maxDiscountType: e.target.value as "PERCENT" })} disabled={!editable}>
                      <option value="PERCENT">%</option>
                      <option value="AMOUNT">$</option>
                    </NativeSelect>
                    <Input id="maxDiscountValue" type="number" min={0} step="0.01" value={g.maxDiscountValue} onChange={(e) => setG({ ...g, maxDiscountValue: e.target.value })} placeholder="No limit" disabled={!editable} />
                  </div>
                </F>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={g.isActive} onChange={(e) => setG({ ...g, isActive: e.target.checked })} disabled={!editable} /> Active</label>
                  <label className="flex items-center gap-2"><Checkbox checked={all.length > 0 && all.every((k) => g.permissions.includes(k))} onChange={(e) => setG({ ...g, permissions: e.target.checked ? all : [] })} disabled={!editable} /> Check All Boxes</label>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sections.map((s) => (
                <Card key={s.title} className="gap-1 py-3">
                  <CardHeader className="px-4"><CardTitle className="text-sm">{s.title}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 text-sm">
                    {s.items.map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2"><Checkbox checked={g.permissions.includes(k)} onChange={(e) => toggle(k, e.target.checked)} disabled={!editable} /> {label}</label>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
            {editable && (
              <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save</Button></div>
            )}
          </div>
        )}
      </div>
    </FormErrorsContext.Provider>
  );
}
