"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, PlugZapIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { dateTime } from "@mrac/ui/lib/format";
import { FormAlert } from "../../../../_components/booking-kit";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";

/** Settings > Payment Settings > Payment Gateway: Stripe keys, test/live mode and what online bookings do with the card. */
export function PaymentGatewayForm() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const q = useQuery(trpc.staff.paymentGateway.get.queryOptions());
  const [v, setV] = React.useState<{ isActive: boolean; testMode: boolean; publishableKey: string; secretKey: string; webhookSecret: string; onlineMode: string } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  React.useEffect(() => {
    if (q.data && !v) setV({ isActive: q.data.isActive, testMode: q.data.testMode, publishableKey: q.data.publishableKey, secretKey: "", webhookSecret: "", onlineMode: q.data.onlineMode });
  }, [q.data, v]);

  if (q.error) return <p className="p-6 text-sm text-destructive">{q.error.message}</p>;
  if (!q.data || !v) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => (s ? { ...s, [k]: val } : s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await client.staff.paymentGateway.save.mutate({ ...v!, onlineMode: v!.onlineMode as "SAVE_CARD" });
      toast.success("Payment gateway saved");
      setV((s) => (s ? { ...s, secretKey: "", webhookSecret: "" } : s));
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
      const r = await client.staff.paymentGateway.test.mutate();
      toast.success(`Connected to ${r.account}${r.chargesEnabled ? "" : " (charges not enabled on this Stripe account yet)"}`);
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
          <CardHeader><CardTitle>Stripe</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Take cards on the website (Active)
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={v.testMode} onChange={(e) => set("testMode", e.target.checked)} /> Test mode (use Stripe test keys: pk_test_… / sk_test_…)
            </label>
            <F label="Publishable key" name="publishableKey" full>
              <Input id="publishableKey" value={v.publishableKey} onChange={(e) => set("publishableKey", e.target.value)} placeholder="pk_test_…" autoComplete="off" spellCheck={false} />
            </F>
            <F label="Secret key" name="secretKey" full hint={q.data.secretKey ? `Saved: ${q.data.secretKey}. Leave blank to keep it.` : "Not saved yet."}>
              <Input id="secretKey" type="password" value={v.secretKey} onChange={(e) => set("secretKey", e.target.value)} placeholder={q.data.secretKey ? "•••••••• (unchanged)" : "sk_test_…"} autoComplete="new-password" spellCheck={false} />
            </F>
            <F label="Webhook signing secret (optional)" name="webhookSecret" full hint={q.data.webhookSecret ? `Saved: ${q.data.webhookSecret}. Leave blank to keep it.` : "Only needed for webhooks (not used yet)."}>
              <Input id="webhookSecret" type="password" value={v.webhookSecret} onChange={(e) => set("webhookSecret", e.target.value)} placeholder="whsec_…" autoComplete="new-password" spellCheck={false} />
            </F>
            <F label="Online bookings" name="onlineMode" full>
              <NativeSelect id="onlineMode" value={v.onlineMode} onChange={(e) => set("onlineMode", e.target.value)}>
                <option value="SAVE_CARD">Save the card — charge at the counter (no money held)</option>
                <option value="AUTHORIZE">Authorize — hold the booking total on the card</option>
              </NativeSelect>
            </F>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} Save</Button>
          <Button type="button" variant="outline" onClick={test} disabled={testing || !q.data.secretKey}>{testing ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />} Test connection</Button>
          {q.data.updatedAt && <span className="text-xs text-muted-foreground">Last saved {dateTime(q.data.updatedAt)}</span>}
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
