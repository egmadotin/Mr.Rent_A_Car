"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Textarea } from "@mrac/ui/components/textarea";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, SelectField, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Settings > SMS Notification (SMSNotificationMain.aspx, SMSNotificationUsersMain.aspx, ProvidersMain.aspx): texts to
 * staff, sent as an email to their carrier's SMS gateway through Settings > Email Setup.
 */
export function SmsSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.email.smsSettings.queryOptions());
  const locations = useQuery(trpc.staff.reports.filters.queryOptions()).data?.locations ?? [];
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.email.smsSettings.queryKey() });
  const editable = can("Settings");
  const d = q.data;
  if (!d) return null;
  type U = (typeof d.users)[number];

  const userDialog = (u?: U) => (
    <FormDialog
      title={u ? `Edit ${u.name}` : "Add Notification User"}
      wide
      trigger={u
        ? <Button size="icon-sm" variant="ghost" aria-label={`Edit ${u.name}`} disabled={!editable}><PencilIcon /></Button>
        : <Button disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New User</Button>}
      onSubmit={async (v) => {
        await client.staff.email.smsUserSave.mutate({
          id: u?.id, name: String(v.name ?? ""), phone: String(v.phone ?? ""), provider: String(v.provider ?? ""), email: (v.email as string) ?? "",
          locationId: (v.locationId as string) || null, newReservation: !!v.newReservation, realtimeDashboard: !!v.realtimeDashboard, isActive: !!v.isActive,
        } as never);
        toast.success("Notification user saved");
        await refresh();
      }}
    >
      <Field label="Username" name="name" required defaultValue={u?.name} />
      <Field label="Mobile Phone" name="phone" type="tel" required defaultValue={u?.phone} hint="Numbers only, no dashes or spaces." />
      <SelectField label="Provider" name="provider" required options={d.providers.map((p) => ({ value: p.name, label: p.name }))} defaultValue={u?.provider ?? "Rogers Wireless(Canada)"} placeholder={false} />
      <Field label="Email" name="email" type="email" defaultValue={u?.email ?? ""} />
      <SelectField label="Location" name="locationId" options={locations.map((l) => ({ value: l.id, label: l.name }))} placeholder="All locations" defaultValue={u?.locationId ?? ""} />
      <div className="space-y-1.5">
        <CheckField label="New Reservation Message" name="newReservation" defaultChecked={u?.newReservation ?? true} />
        <CheckField label="Realtime Dash Message" name="realtimeDashboard" defaultChecked={u?.realtimeDashboard ?? false} />
        <CheckField label="Active" name="isActive" defaultChecked={u?.isActive ?? true} />
      </div>
    </FormDialog>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SetupCard d={d} editable={editable} onSaved={refresh} />

      <Card className="gap-3">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>SMS Notification Users</CardTitle>
          {userDialog()}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>User Name</TableHead><TableHead>Phone</TableHead><TableHead>Provider</TableHead><TableHead>Location</TableHead><TableHead>Res. Message</TableHead><TableHead>Real-Time Dashboard</TableHead><TableHead>Active</TableHead><TableHead className="w-28" /></TableRow>
            </TableHeader>
            <TableBody>
              {d.users.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
              {d.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="tabular-nums">{u.phone}</TableCell>
                  <TableCell>{u.provider}</TableCell>
                  <TableCell>{u.location?.name ?? "All"}</TableCell>
                  <TableCell>{u.newReservation ? "Enabled" : "—"}</TableCell>
                  <TableCell>{u.realtimeDashboard ? "Enabled" : "—"}</TableCell>
                  <TableCell>{u.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" disabled={!editable} onClick={() => client.staff.email.smsTest.mutate({ phone: u.phone, provider: u.provider }).then(() => toast.success(`Test text sent to ${u.phone}`), (e) => toast.error(errorMessage(e)))}>Send SMS</Button>
                    {userDialog(u)}
                    <Button size="icon-sm" variant="ghost" aria-label={`Delete ${u.name}`} disabled={!editable} onClick={() => setDeleting({ id: u.id, name: u.name })}><Trash2Icon /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader><CardTitle>SMS Providers</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">A text goes out as an email to the mobile number at the carrier&apos;s gateway (e.g. 6045551234@txt.bell.ca), through Settings › Email Setup. RentCentric&apos;s {d.providers.length} providers:</p>
          <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {d.providers.map((p) => <div key={p.name} className="flex justify-between gap-2 border-b py-1"><span>{p.name}</span><span className="font-mono text-xs text-muted-foreground">{p.gateway}</span></div>)}
          </div>
        </CardContent>
      </Card>

      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="They stop getting notification texts."
        confirmLabel="Delete"
        destructive
        onConfirm={() => client.staff.email.smsUserDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}

type Setup = { newResEnabled: boolean; newResMessage: string; dashboardEnabled: boolean; dashboardMessage: string; dashboardTimes: string[]; newResKeywords: string[]; dashboardKeywords: string[] };

/** SMSNotificationMain.aspx: the two messages with their keywords ("click to insert") and Enable, plus the dashboard's times. */
function SetupCard({ d, editable, onSaved }: { d: Setup; editable: boolean; onSaved: () => unknown }) {
  const client = useTRPCClient();
  const [v, setV] = React.useState({ newResEnabled: d.newResEnabled, newResMessage: d.newResMessage, dashboardEnabled: d.dashboardEnabled, dashboardMessage: d.dashboardMessage, dashboardTimes: d.dashboardTimes });
  const [time, setTime] = React.useState("08:00");
  const [saving, setSaving] = React.useState(false);
  const refs = { newResMessage: React.useRef<HTMLTextAreaElement>(null), dashboardMessage: React.useRef<HTMLTextAreaElement>(null) };
  const insert = (k: "newResMessage" | "dashboardMessage", word: string) => {
    const el = refs[k].current;
    const cur = v[k];
    const at = el?.selectionStart ?? cur.length;
    setV({ ...v, [k]: `${cur.slice(0, at)}##${word}##${cur.slice(el?.selectionEnd ?? at)}` });
    el?.focus();
  };
  const block = (title: string, k: "newResMessage" | "dashboardMessage", on: "newResEnabled" | "dashboardEnabled", words: string[]) => (
    <div className="space-y-2">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">Keywords — click to insert:</p>
      <div className="flex flex-wrap gap-1">
        {words.map((w) => <button key={w} type="button" disabled={!editable} onClick={() => insert(k, w)} className="rounded-md border px-2 py-0.5 text-xs hover:bg-muted">{w}</button>)}
      </div>
      <Textarea ref={refs[k]} rows={3} value={v[k]} disabled={!editable} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v[on]} disabled={!editable} onChange={(e) => setV({ ...v, [on]: e.target.checked })} className="size-4" /> Enable</label>
    </div>
  );

  return (
    <Card className="gap-3">
      <CardHeader><CardTitle>SMS Notifications Setup</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {block("New Reservation Notifications", "newResMessage", "newResEnabled", d.newResKeywords)}
        {block("Real Time Dashboard Notifications", "dashboardMessage", "dashboardEnabled", d.dashboardKeywords)}
        <div className="space-y-2">
          <p className="text-sm font-medium">Notification Times (real-time dashboard)</p>
          <div className="flex flex-wrap items-center gap-2">
            {v.dashboardTimes.map((t) => (
              <Badge key={t} variant="muted" className="gap-1">{t}<button type="button" aria-label={`Remove ${t}`} disabled={!editable} onClick={() => setV({ ...v, dashboardTimes: v.dashboardTimes.filter((x) => x !== t) })}><XIcon className="size-3" /></button></Badge>
            ))}
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" disabled={!editable} />
            <Button type="button" variant="outline" size="sm" disabled={!editable || !time} onClick={() => setV({ ...v, dashboardTimes: [...new Set([...v.dashboardTimes, time])].sort() })}>Add Notification Time</Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={saving || !editable}
            title={editable ? undefined : NO_PERMISSION}
            onClick={async () => {
              setSaving(true);
              try {
                await client.staff.email.smsSettingsSave.mutate(v);
                toast.success("SMS notifications saved");
                await onSaved();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
