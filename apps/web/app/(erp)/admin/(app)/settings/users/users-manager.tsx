"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PlusCircleIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { toast } from "@mrac/ui/components/sonner";
import { CheckField, Field, FormDialog, SelectField } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Staff list with Add / Edit (group, default location, admin, active, password reset). */
export function UsersManager({ meId }: { meId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const users = useQuery(trpc.staff.users.list.queryOptions());
  const groups = useQuery(trpc.staff.users.groups.queryOptions()).data ?? [];
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const structures = useQuery(trpc.staff.setup.commissionStructures.queryOptions()).data ?? [];
  const sections = useQuery(trpc.staff.users.catalog.queryOptions()).data ?? [];
  const [editing, setEditing] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  if (users.error) return <p className="p-6 text-sm text-destructive">{users.error.message}</p>;
  const groupOptions = [{ value: "", label: "— none —" }, ...groups.map((g) => ({ value: g.id, label: g.name }))];
  const locationOptions = [{ value: "", label: "— none —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))];
  const u = users.data?.find((x) => x.id === editing);
  const isAdmin = !!can.me?.isAdmin;
  const access = (ids: string[]) => (ids.length ? locations.filter((l) => ids.includes(l.id)).map((l) => l.name).join(", ") : null);
  const ticked = (v: Record<string, unknown>) => locations.filter((l) => v[`loc_${l.id}`]).map((l) => l.id);

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} disabled={!can("AdminsAdd")} title={can("AdminsAdd") ? undefined : NO_PERMISSION}><PlusCircleIcon /> Add user</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>User Group</TableHead><TableHead>Default Location</TableHead><TableHead>Location Access</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}{x.id === meId && <span className="text-muted-foreground"> (you)</span>}</TableCell>
                <TableCell>{x.email}</TableCell>
                <TableCell>
                  {x.role === "admin" ? <Badge>Full Admin</Badge> : x.userGroup?.name ?? <span className="text-muted-foreground">none</span>}
                  {x.role !== "admin" && (x.permissionsAdded.length > 0 || x.permissionsRemoved.length > 0) && (
                    <Badge variant="muted" className="ml-1.5" title="This user's own permission changes">
                      {[x.permissionsAdded.length && `+${x.permissionsAdded.length}`, x.permissionsRemoved.length && `−${x.permissionsRemoved.length}`].filter(Boolean).join(" ")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{x.defaultLocation?.name ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate" title={access(x.locationIds) ?? undefined}>
                  {x.role === "admin" ? "All" : access(x.locationIds) ?? <span className="text-muted-foreground">{groups.find((g) => g.id === x.userGroupId)?.locationId ? `Group: ${locations.find((l) => l.id === groups.find((g) => g.id === x.userGroupId)?.locationId)?.name ?? "—"}` : "All"}</span>}
                </TableCell>
                <TableCell>{x.banned ? <Badge variant="muted">Inactive</Badge> : <Badge variant="success">Active</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(x.id)} disabled={!can("AdminsEdit")} title={can("AdminsEdit") ? undefined : NO_PERMISSION}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.isLoading && <TableRow><TableCell colSpan={7} className="text-muted-foreground">Loading…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <FormDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add user"
        description="They sign in with this email and temporary password."
        submitLabel="Add user"
        onSubmit={async (v) => {
          await client.staff.users.create.mutate({
            name: v.name as string,
            email: v.email as string,
            password: v.password as string,
            userGroupId: (v.userGroupId as string) || undefined,
            defaultLocationId: (v.defaultLocationId as string) || undefined,
            locationIds: ticked(v),
            permissions: (v.perm as string[] | undefined) ?? [],
            isAdmin: Boolean(v.isAdmin),
          });
          toast.success("User added");
          await users.refetch();
        }}
      >
        <Field label="Name" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Temporary password" name="password" type="password" required hint="At least 10 characters." autoComplete="new-password" />
        <SelectField label="User Group" name="userGroupId" options={groupOptions} placeholder={false} />
        <SelectField label="Default Location" name="defaultLocationId" options={locationOptions} placeholder={false} />
        <LocationAccess locations={locations} />
        <UserPermissions sections={sections} groups={groups} />
        {isAdmin && <CheckField label="Full Admin (can do everything, incl. settings with keys)" name="isAdmin" />}
      </FormDialog>

      {u && (
        <FormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Edit ${u.name}`}
          submitLabel="Save"
          onSubmit={async (v) => {
            await client.staff.users.update.mutate({
              id: u.id,
              name: v.name as string,
              userGroupId: (v.userGroupId as string) || undefined,
              defaultLocationId: (v.defaultLocationId as string) || undefined,
              locationIds: ticked(v),
              permissions: (v.perm as string[] | undefined) ?? [],
              isAdmin: isAdmin ? Boolean(v.isAdmin) : u.role === "admin",
              active: Boolean(v.active),
              newPassword: (v.newPassword as string) || undefined,
              commissionStructureIds: structures.filter((st) => v[`cs_${st.id}`]).map((st) => st.id),
              commissionType: (v.commissionType as "PERCENT") || null,
              commissionAmount: v.commissionAmount as never,
            });
            toast.success("User saved");
            setEditing(null);
            await users.refetch();
          }}
        >
          <Field label="Name" name="name" required defaultValue={u.name} />
          <SelectField label="User Group" name="userGroupId" options={groupOptions} defaultValue={u.userGroupId ?? ""} placeholder={false} />
          <SelectField label="Default Location" name="defaultLocationId" options={locationOptions} defaultValue={u.defaultLocationId ?? ""} placeholder={false} />
          <LocationAccess locations={locations} ids={u.locationIds} />
          <UserPermissions sections={sections} groups={groups} groupId={u.userGroupId} added={u.permissionsAdded} removed={u.permissionsRemoved} />
          {isAdmin && <CheckField label="Full Admin" name="isAdmin" defaultChecked={u.role === "admin"} />}
          <CheckField label="Active (can sign in)" name="active" defaultChecked={!u.banned} />
          <Field label="New password (optional)" name="newPassword" type="password" hint="Leave blank to keep the current one." autoComplete="new-password" />
          <fieldset className="space-y-1.5 sm:col-span-2">
            <legend className="text-sm font-medium">Commission Structure</legend>
            {structures.length === 0 && <p className="text-xs text-muted-foreground">None set up (Settings › Commission Structures).</p>}
            {structures.map((st) => <CheckField key={st.id} label={`${st.name}${st.location ? ` — ${st.location.name}` : ""}`} name={`cs_${st.id}`} defaultChecked={u.commissionStructureIds.includes(st.id)} />)}
          </fieldset>
          <SelectField label="Commission" name="commissionType" options={[{ value: "PERCENT", label: "Percentage %" }, { value: "AMOUNT", label: "Dollar Amount $" }]} placeholder="None" defaultValue={u.commissionType ?? ""} />
          <Field label="Commission Amount" name="commissionAmount" type="number" min={0} step="0.01" defaultValue={u.commissionAmount != null ? String(u.commissionAmount) : ""} />
        </FormDialog>
      )}
    </div>
  );
}

/** Users form "Location Access": one tick per branch. */
function LocationAccess({ locations, ids }: { locations: { id: string; name: string }[]; ids?: string[] }) {
  return (
    <fieldset className="space-y-1.5 sm:col-span-2">
      <legend className="text-sm font-medium">Location Access</legend>
      <p className="text-xs text-muted-foreground">The branches this user can work in. None ticked = the user group&apos;s location (or all locations). Full Admins always have every location.</p>
      {locations.map((l) => <CheckField key={l.id} label={l.name} name={`loc_${l.id}`} defaultChecked={ids?.includes(l.id)} />)}
    </fieldset>
  );
}

/**
 * Users form "Permissions": every permission, ticked as the user's group has them plus / minus this user's own changes.
 * Ticks that differ from the group are marked; "Use group's permissions" resets to the group picked above.
 */
function UserPermissions({ sections, groups, groupId: initialGroupId, added = [], removed = [] }: {
  sections: { title: string; items: [string, string][] }[];
  groups: { id: string; permissions: string[] }[];
  groupId?: string | null;
  added?: string[];
  removed?: string[];
}) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const [groupId, setGroupId] = React.useState(initialGroupId ?? "");
  const groupPerms = (id: string) => groups.find((g) => g.id === id)?.permissions ?? [];
  const [ticked, setTicked] = React.useState<Set<string>>(() => new Set([...groupPerms(initialGroupId ?? ""), ...added].filter((p) => !removed.includes(p))));
  // follow the User Group picked in the same form: a new group starts from its own ticks
  React.useEffect(() => {
    const form = ref.current?.closest("form");
    const onChange = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      if (t.name !== "userGroupId") return;
      setGroupId(t.value);
      setTicked(new Set(groups.find((g) => g.id === t.value)?.permissions ?? []));
    };
    form?.addEventListener("change", onChange);
    return () => form?.removeEventListener("change", onChange);
  }, [groups]);
  const base = new Set(groupPerms(groupId));
  const extra = [...ticked].filter((p) => !base.has(p)).length;
  const taken = [...base].filter((p) => !ticked.has(p)).length;
  const toggle = (k: string, on: boolean) => setTicked((t) => { const n = new Set(t); if (on) n.add(k); else n.delete(k); return n; });

  return (
    <details ref={ref} className="rounded-md border p-3 sm:col-span-2">
      <summary className="cursor-pointer text-sm font-medium">
        Permissions <span className="font-normal text-muted-foreground">— {ticked.size} ticked{extra ? ` · +${extra} extra` : ""}{taken ? ` · −${taken} removed` : ""} (Full Admins have everything)</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <Button type="button" size="sm" variant="outline" onClick={() => setTicked(new Set(base))}>Use group&apos;s permissions</Button>
        <span className="text-muted-foreground"><span className="font-semibold text-forest-100">+</span> extra for this user · <span className="font-semibold text-destructive">−</span> taken away from the group</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {sections.map((sec) => (
          <fieldset key={sec.title} className="space-y-1">
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.title}</legend>
            {sec.items.map(([k, label]) => {
              const on = ticked.has(k);
              const diff = on !== base.has(k);
              return (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="perm" value={k} data-multi="1" checked={on} onChange={(e) => toggle(k, e.target.checked)} className="size-4" />
                  {label}
                  {diff && <span className={on ? "font-semibold text-forest-100" : "font-semibold text-destructive"}>{on ? "+" : "−"}</span>}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </details>
  );
}
