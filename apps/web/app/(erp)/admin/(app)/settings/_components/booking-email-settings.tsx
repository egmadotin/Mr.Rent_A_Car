"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (s: string) => s || null;

/** Settings > Reservation Email (WebCustomerEmailSetup.aspx): per location, with "Use For All Locations". */
export function ReservationEmailSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.reports.filters.queryOptions()).data?.locations ?? [];
  const [locationId, setLocationId] = React.useState("");
  const loc = locationId || locations[0]?.id || "";
  const q = useQuery({ ...trpc.staff.email.reservationEmailGet.queryOptions({ locationId: loc }), enabled: !!loc });
  const [saving, setSaving] = React.useState(false);
  const editable = can("AgreementFormsEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const r = await client.staff.email.reservationEmailSave.mutate({
        locationId: loc, allLocations: fd.get("all") === "on",
        data: {
          fromName: orNull(str(fd, "fromName")), fromEmail: orNull(str(fd, "fromEmail")), format: str(fd, "format") as "HTML" | "TEXT", copyTo: orNull(str(fd, "copyTo")),
          subject: str(fd, "subject"), body: String(fd.get("body") ?? ""), identityVerificationUrl: orNull(str(fd, "idUrl")),
        },
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.email.reservationEmailGet.queryKey() });
      toast.success(r.saved > 1 ? `Reservation Email saved for ${r.saved} locations` : "Reservation Email saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const d = q.data;
  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-3xl">
        <CardContent className="space-y-4">
          <F label="Location" name="loc">
            <NativeSelect id="loc" value={loc} onChange={(e) => setLocationId(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect>
          </F>
          {d && (
            <form key={loc} onSubmit={save} className="space-y-4">
              <fieldset disabled={!editable} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <F label="From Name" name="fromName"><Input id="fromName" name="fromName" defaultValue={d.fromName} /></F>
                  <F label="Email Address (From)" name="fromEmail"><Input id="fromEmail" name="fromEmail" type="email" defaultValue={d.fromEmail} /></F>
                  <F label="To Email (copy to staff)" name="copyTo"><Input id="copyTo" name="copyTo" type="email" defaultValue={d.copyTo} /></F>
                  <F label="Email Format" name="format">
                    <NativeSelect id="format" name="format" defaultValue={d.format}><option value="HTML">HTML</option><option value="TEXT">Text</option></NativeSelect>
                  </F>
                </div>
                <F label="Email Subject" name="subject" required><Input id="subject" name="subject" defaultValue={d.subject} /></F>
                <F label="Email Body" name="body" hint="Leave empty to send the location's Reservation Confirmation template. Template codes (##ResNumber##, ##PickupDate## …) are filled.">
                  <Textarea id="body" name="body" rows={12} className="font-mono text-xs" defaultValue={d.body} />
                </F>
                <F label="Identity Verification URL" name="idUrl"><Input id="idUrl" name="idUrl" defaultValue={d.identityVerificationUrl} /></F>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="all" className="size-4" /> Use For All Locations</label>
              </fieldset>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Settings > Quote Email (QuoteCustomerEmail.aspx): Subject and the email body (HTML with ##codes##). */
export function QuoteEmailSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.email.quoteEmailGet.queryOptions());
  const [saving, setSaving] = React.useState(false);
  if (!q.data) return null;
  const editable = can("AgreementFormsEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.email.quoteEmailSave.mutate({ subject: str(fd, "subject"), body: String(fd.get("body") ?? "") });
      await qc.invalidateQueries({ queryKey: trpc.staff.email.quoteEmailGet.queryKey() });
      toast.success("Quote Email saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-3xl">
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={!editable} className="space-y-4">
              <F label="Subject" name="subject" required><Input id="subject" name="subject" defaultValue={q.data.subject} /></F>
              <F label="Email (HTML)" name="body" hint="Codes: ##QuoteNumber##, ##QuoteDate##, ##FirstName##, ##PickupDate##, ##ChargesSummary##, ##LocationLogo## … Leave empty to send the Quote template.">
                <Textarea id="body" name="body" rows={18} className="font-mono text-xs" defaultValue={q.data.body} />
              </F>
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
