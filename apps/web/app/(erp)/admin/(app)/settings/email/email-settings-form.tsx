"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { FormAlert } from "../../../../_components/booking-kit";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";

type V = { isActive: boolean; host: string; port: string; secure: boolean; username: string; password: string; fromName: string; fromEmail: string; bccEmail: string };

/** Settings > Website & Email Setup > Email Setup: SMTP server, login (password write-only), From, BCC, Send test. */
export function EmailSettingsForm({ adminEmail }: { adminEmail: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const q = useQuery(trpc.staff.email.settings.queryOptions());
  const [v, setV] = React.useState<V | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [testTo, setTestTo] = React.useState(adminEmail);
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => {
    if (q.data && !v) setV({ ...q.data, port: String(q.data.port), password: "" });
  }, [q.data, v]);
  if (q.error) return <p className="p-6 text-sm text-destructive">{q.error.message}</p>;
  if (!q.data || !v) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const set = <K extends keyof V>(k: K, val: V[K]) => setV((s) => (s ? { ...s, [k]: val } : s));
  const text = (k: "host" | "port" | "username" | "fromName" | "fromEmail" | "bccEmail", placeholder?: string, type = "text") => (
    <Input id={k} type={type} value={v[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} autoComplete="off" />
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await client.staff.email.saveSettings.mutate({ ...v!, port: Number(v!.port), password: v!.password || undefined });
      toast.success("Email settings saved");
      setV((s) => (s ? { ...s, password: "" } : s));
      await q.refetch();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await client.staff.email.test.mutate({ to: testTo });
      toast.success(`Test email sent to ${testTo}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={save} noValidate className="max-w-3xl space-y-4 p-4 md:p-6">
        <FormAlert message={formError} />
        <Card>
          <CardHeader><CardTitle>SMTP account</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Send emails (Active)</label>
            <F label="SMTP server" name="host">{text("host", "smtp.gmail.com")}</F>
            <F label="Port" name="port">{text("port", "587", "number")}</F>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={v.secure} onChange={(e) => set("secure", e.target.checked)} /> Use SSL/TLS from the start (port 465). Leave off for 587 (STARTTLS).</label>
            <F label="Username" name="username">{text("username", "bookings@mrrentacar.com")}</F>
            <F label="Password" name="password" hint={q.data.password ? "Saved. Leave blank to keep it." : "Not saved yet. For Gmail / Microsoft 365 use an app password."}>
              <Input id="password" type="password" value={v.password} onChange={(e) => set("password", e.target.value)} placeholder={q.data.password ? "•••••••• (unchanged)" : ""} autoComplete="new-password" />
            </F>
            <F label="From name" name="fromName">{text("fromName", "Mr Rent A Car")}</F>
            <F label="From email" name="fromEmail">{text("fromEmail", "bookings@mrrentacar.com", "email")}</F>
            <F label="BCC every email to (optional)" name="bccEmail" full>{text("bccEmail", "office@mrrentacar.com", "email")}</F>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} Save</Button>
          <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} className="w-64" aria-label="Send test email to" />
          <Button type="button" variant="outline" onClick={test} disabled={testing || !q.data.isActive}>{testing ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send test</Button>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
