"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** RentCentric's "Select Email" list, same wording and order. */
const AUDIENCE = [
  { value: "DIRECT", label: "Direct Email to All Customers" },
  { value: "BIRTHDAY", label: "Everyone with a Birthday in a given range" },
  { value: "NEW_CUSTOMERS", label: "New Customers in a given period" },
  { value: "LOCATION", label: "Select Customers From Location" },
  { value: "CONFIRMED_RESERVATIONS", label: "Customers with confirmed reservations in a given range" },
  { value: "ON_RENT", label: "Email to All Customers On Rent" },
  { value: "CLOSED_RENTALS", label: "Customers with closed rentals in a given range" },
] as const;
type Audience = (typeof AUDIENCE)[number]["value"];
const RANGED: Audience[] = ["BIRTHDAY", "NEW_CUSTOMERS", "CONFIRMED_RESERVATIONS", "CLOSED_RENTALS"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MAX_FILE = 5 * 1024 * 1024;

/** Settings > Email Marketing > Send Marketing Email (EmailMarketing.aspx). */
export function MarketingEmail() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.reports.filters.queryOptions()).data?.locations ?? [];
  const [a, setA] = React.useState({ audience: "" as Audience | "", startDay: "", startMonth: "", endDay: "", endMonth: "", locationId: "", email: "" });
  const [format, setFormat] = React.useState<"TEXT" | "HTML">("HTML");
  const [sending, setSending] = React.useState(false);
  const editable = can("Settings");
  const ranged = !!a.audience && RANGED.includes(a.audience);
  const audienceArgs = {
    audience: a.audience || undefined, locationId: a.locationId || undefined, email: a.email || undefined,
    startDay: a.startDay ? Number(a.startDay) : undefined, startMonth: a.startMonth ? Number(a.startMonth) : undefined,
    endDay: a.endDay ? Number(a.endDay) : undefined, endMonth: a.endMonth ? Number(a.endMonth) : undefined,
  };
  const ready = !!a.audience && (!ranged || (a.startDay && a.startMonth && a.endDay && a.endMonth)) && (a.audience !== "LOCATION" || a.locationId);
  const count = useQuery({ ...trpc.staff.marketing.count.queryOptions(audienceArgs), enabled: editable && !!ready, retry: false });
  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA({ ...a, [k]: e.target.value });

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    if (file && file.size > MAX_FILE) return toast.error("The attachment can be at most 5 MB.");
    const n = (count.data?.count ?? 0) + (!a.audience && a.email ? 1 : 0);
    if (!confirm(`Send this email to ${n} recipient${n === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      const attachment = file && file.size ? { filename: file.name, contentType: file.type || "application/octet-stream", base64: await toBase64(file) } : undefined;
      const r = await client.staff.marketing.send.mutate({
        ...audienceArgs, format, fromName: String(fd.get("fromName") ?? ""), fromEmail: String(fd.get("fromEmail") ?? ""),
        subject: String(fd.get("subject") ?? ""), body: String(fd.get("body") ?? ""), allowUnsubscribe: fd.get("unsubscribe") === "on", attachment,
      });
      if (r.failed.length) toast.error(`${r.sent} sent, ${r.failed.length} failed (${r.failed.slice(0, 3).join(", ")}${r.failed.length > 3 ? "…" : ""})`);
      else toast.success(`${r.sent} email${r.sent === 1 ? "" : "s"} sent`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-3xl">
        <CardContent>
          <form onSubmit={send} className="space-y-4">
            <fieldset disabled={!editable} className="space-y-4">
              <F label="Email Template" name="template">
                <NativeSelect id="template" disabled><option>None</option></NativeSelect>
              </F>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label="From Email" name="fromEmail"><Input id="fromEmail" name="fromEmail" type="email" placeholder="Settings › Email Setup's when blank" /></F>
                <F label="From Name" name="fromName"><Input id="fromName" name="fromName" /></F>
              </div>
              <F label="Send To" name="audience">
                <NativeSelect id="audience" value={a.audience} onChange={set("audience")}>
                  <option value="">---- Select Email ----</option>
                  {AUDIENCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </F>
              <F label="Email" name="email"><Input id="email" type="email" value={a.email} onChange={set("email")} placeholder="Also send to this address (e.g. a test copy)" /></F>
              {ranged && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <F label="Start Day" name="startDay"><NativeSelect id="startDay" value={a.startDay} onChange={set("startDay")}><option value="">Day</option>{DAYS.map((d) => <option key={d}>{d}</option>)}</NativeSelect></F>
                  <F label="Start Month" name="startMonth"><NativeSelect id="startMonth" value={a.startMonth} onChange={set("startMonth")}><option value="">Month</option>{MONTHS.map((m) => <option key={m}>{m}</option>)}</NativeSelect></F>
                  <F label="End Day" name="endDay"><NativeSelect id="endDay" value={a.endDay} onChange={set("endDay")}><option value="">Day</option>{DAYS.map((d) => <option key={d}>{d}</option>)}</NativeSelect></F>
                  <F label="End Month" name="endMonth"><NativeSelect id="endMonth" value={a.endMonth} onChange={set("endMonth")}><option value="">Month</option>{MONTHS.map((m) => <option key={m}>{m}</option>)}</NativeSelect></F>
                </div>
              )}
              {a.audience === "LOCATION" && (
                <F label="Location" name="locationId">
                  <NativeSelect id="locationId" value={a.locationId} onChange={set("locationId")}><option value="">Select</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect>
                </F>
              )}
              {ready && (
                <p className="text-sm">
                  {count.isLoading ? "Counting…" : count.error ? <span className="text-destructive">{count.error.message}</span> : (
                    <><span className="font-semibold">{count.data?.count ?? 0} recipient{count.data?.count === 1 ? "" : "s"}</span> (customers with an email who haven’t unsubscribed){count.data?.sample.length ? ` — ${count.data.sample.join(", ")}${(count.data.count ?? 0) > count.data.sample.length ? "…" : ""}` : ""}</>
                  )}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <F label="Format" name="format">
                  <NativeSelect id="format" value={format} onChange={(e) => setFormat(e.target.value as "TEXT" | "HTML")}><option value="TEXT">Text</option><option value="HTML">Html</option></NativeSelect>
                </F>
                <F label="Subject" name="subject" required><Input id="subject" name="subject" /></F>
              </div>
              <F label="Attachment" name="file"><Input id="file" name="file" type="file" /></F>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unsubscribe" defaultChecked className="size-4" /> Allow Customer To Unsubscribe</label>
              <F label={format === "HTML" ? "Email (HTML)" : "Email"} name="body" required><Textarea id="body" name="body" rows={14} className={format === "HTML" ? "font-mono text-xs" : undefined} /></F>
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit" disabled={sending || !editable || (!ready && !a.email)} title={editable ? undefined : NO_PERMISSION}>{sending ? "Sending…" : "Send"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
