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
  const [editing, setEditing] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  if (users.error) return <p className="p-6 text-sm text-destructive">{users.error.message}</p>;
  const groupOptions = [{ value: "", label: "— none —" }, ...groups.map((g) => ({ value: g.id, label: g.name }))];
  const locationOptions = [{ value: "", label: "— none —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))];
  const u = users.data?.find((x) => x.id === editing);
  const isAdmin = !!can.me?.isAdmin;

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)} disabled={!can("AdminsAdd")} title={can("AdminsAdd") ? undefined : NO_PERMISSION}><PlusCircleIcon /> Add user</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>User Group</TableHead><TableHead>Default Location</TableHead><TableHead>Status</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((x) => (
              <TableRow key={x.id}>
                <TableCell className="font-medium">{x.name}{x.id === meId && <span className="text-muted-foreground"> (you)</span>}</TableCell>
                <TableCell>{x.email}</TableCell>
                <TableCell>{x.role === "admin" ? <Badge>Full Admin</Badge> : x.userGroup?.name ?? <span className="text-muted-foreground">none</span>}</TableCell>
                <TableCell>{x.defaultLocation?.name ?? "—"}</TableCell>
                <TableCell>{x.banned ? <Badge variant="muted">Inactive</Badge> : <Badge variant="success">Active</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(x.id)} disabled={!can("AdminsEdit")} title={can("AdminsEdit") ? undefined : NO_PERMISSION}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
            {users.isLoading && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Loading…</TableCell></TableRow>}
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
              isAdmin: isAdmin ? Boolean(v.isAdmin) : u.role === "admin",
              active: Boolean(v.active),
              newPassword: (v.newPassword as string) || undefined,
            });
            toast.success("User saved");
            setEditing(null);
            await users.refetch();
          }}
        >
          <Field label="Name" name="name" required defaultValue={u.name} />
          <SelectField label="User Group" name="userGroupId" options={groupOptions} defaultValue={u.userGroupId ?? ""} placeholder={false} />
          <SelectField label="Default Location" name="defaultLocationId" options={locationOptions} defaultValue={u.defaultLocationId ?? ""} placeholder={false} />
          {isAdmin && <CheckField label="Full Admin" name="isAdmin" defaultChecked={u.role === "admin"} />}
          <CheckField label="Active (can sign in)" name="active" defaultChecked={!u.banned} />
          <Field label="New password (optional)" name="newPassword" type="password" hint="Leave blank to keep the current one." autoComplete="new-password" />
        </FormDialog>
      )}
    </div>
  );
}
