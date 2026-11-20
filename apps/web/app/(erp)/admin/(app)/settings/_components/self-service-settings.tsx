"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { SELF_SERVICE_KEYWORDS, SELF_SERVICE_SECTIONS } from "@mrac/api/self-service";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { ExternalLinkIcon } from "lucide-react";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Location picker + that location's setup (all four pages are per location, as in RentCentric). */
function useSetup() {
  const trpc = useTRPC();
  const locations = useQuery(trpc.staff.reports.filters.queryOptions()).data?.locations ?? [];
  const [locationId, setLocationId] = React.useState("");
  const loc = locationId || locations[0]?.id || "";
  const q = useQuery({ ...trpc.staff.selfService.get.queryOptions({ locationId: loc }), enabled: !!loc });
  const picker = (
    <F label="Location" name="loc">
      <NativeSelect id="loc" value={loc} onChange={(e) => setLocationId(e.target.value)}>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </NativeSelect>
    </F>
  );
  return { loc, data: q.data, picker, queryKey: trpc.staff.selfService.get.queryKey() };
}

function SaveBar({ saving, editable }: { saving: boolean; editable: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" asChild><Link href="/admin/settings">Cancel</Link></Button>
      <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}

/** Settings > Self Service & Car Share SetUp > Rental Setup (SelfServiceSetup.aspx). */
export function SelfServiceRentalSetup() {
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { loc, data, picker, queryKey } = useSetup();
  const [saving, setSaving] = React.useState(false);
  const editable = can("Settings");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rental: Record<string, boolean | number> = {};
    for (const s of SELF_SERVICE_SECTIONS) for (const f of s.fields) rental[f.key] = f.kind === "bool" ? fd.get(f.key) === "on" : Math.max(0, Math.round(Number(fd.get(f.key)) || 0));
    setSaving(true);
    try {
      await client.staff.selfService.saveRental.mutate({ locationId: loc, rental });
      await qc.invalidateQueries({ queryKey });
      toast.success("Rental Setup saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="max-w-md"><CardContent>{picker}</CardContent></Card>
      {data && (
        <form key={loc} onSubmit={save} className="space-y-4">
          <fieldset disabled={!editable} className="space-y-4">
            {SELF_SERVICE_SECTIONS.map((s, i) => (
              <React.Fragment key={s.title}>
                <Card>
                  <CardHeader><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
                  <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {s.fields.map((f) =>
                      f.kind === "bool" ? (
                        <label key={f.key} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name={f.key} defaultChecked={data.rental[f.key] === true} className="size-4" /> {f.label}
                        </label>
                      ) : (
                        <F key={f.key} label={`${f.label}: ${f.unit}`} name={f.key}>
                          <Input id={f.key} name={f.key} type="number" min={0} step={1} defaultValue={Number(data.rental[f.key] ?? 0)} />
                        </F>
                      ),
                    )}
                  </CardContent>
                </Card>
                {/* Self-Service URLs sit after the Registration Form, as in RentCentric */}
                {i === 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Self-Service URLs</CardTitle></CardHeader>
                    <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                      {[
                        ["Desktop Online Reservation", data.urls.reservation],
                        ["Desktop Online Registration", data.urls.registration],
                        ["Self Service Reservation", data.urls.reservation],
                        ["Self Service Registration", data.urls.registration],
                      ].map(([label, href]) => (
                        <a key={label} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                          {label} <ExternalLinkIcon className="size-3.5" />
                        </a>
                      ))}
                      <p className="text-xs text-muted-foreground sm:col-span-2">The new website handles booking and sign-up on desktop and phone, so the desktop and self-service links open the same pages.</p>
                    </CardContent>
                  </Card>
                )}
              </React.Fragment>
            ))}
          </fieldset>
          <SaveBar saving={saving} editable={editable} />
        </form>
      )}
    </div>
  );
}

/** Settings > Self Service & Car Share SetUp > Self Service Welcome Email / Registration Email (WelcomeEmailSetup / RegistrationEmailSetup.aspx). */
export function SelfServiceEmailSetup({ kind }: { kind: "welcome" | "registration" }) {
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { loc, data, picker, queryKey } = useSetup();
  const [saving, setSaving] = React.useState(false);
  const editable = can("AgreementFormsEdit");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  function insert(k: string) {
    const ta = bodyRef.current;
    if (!ta || ta.disabled) return;
    const code = `#${k}#`;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    ta.value = value.slice(0, a) + code + value.slice(b);
    ta.focus();
    ta.setSelectionRange(a + code.length, a + code.length);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.selfService.saveEmail.mutate({
        locationId: loc, kind,
        email: { fromName: str(fd, "fromName"), format: str(fd, "format") as "HTML" | "TEXT", fromEmail: str(fd, "fromEmail"), replyTo: str(fd, "replyTo"), subject: str(fd, "subject"), body: String(fd.get("body") ?? "") },
      });
      await qc.invalidateQueries({ queryKey });
      toast.success(kind === "welcome" ? "Welcome Email saved" : "Registration Email saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const d = data && (kind === "welcome" ? data.welcomeEmail : data.registrationEmail);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="max-w-md"><CardContent>{picker}</CardContent></Card>
      {d && (
        <form key={loc} onSubmit={save} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <Card>
              <CardContent>
                <fieldset disabled={!editable} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <F label="From Name" name="fromName"><Input id="fromName" name="fromName" defaultValue={d.fromName} /></F>
                    <F label="Email Format" name="format">
                      <NativeSelect id="format" name="format" defaultValue={d.format}><option value="HTML">HTML</option><option value="TEXT">Text</option></NativeSelect>
                    </F>
                    <F label="From Email" name="fromEmail"><Input id="fromEmail" name="fromEmail" type="email" defaultValue={d.fromEmail} /></F>
                    <F label="ReplyTo Email" name="replyTo"><Input id="replyTo" name="replyTo" type="email" defaultValue={d.replyTo} /></F>
                  </div>
                  <F label="Email Subject" name="subject" hint="Leave the subject or body empty and this email isn't sent."><Input id="subject" name="subject" defaultValue={d.subject} /></F>
                  <F label="Email Body" name="body">
                    <Textarea ref={bodyRef} id="body" name="body" rows={16} className="font-mono text-xs" defaultValue={d.body} />
                  </F>
                </fieldset>
              </CardContent>
            </Card>
            <Card className="h-fit">
              <CardHeader><CardTitle className="text-sm">Keywords you can use:</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-1.5 lg:flex-col">
                {SELF_SERVICE_KEYWORDS.map((k) => (
                  <button key={k} type="button" onClick={() => insert(k)} className="rounded border px-1.5 py-0.5 text-left font-mono text-xs hover:bg-muted" title="Insert at the cursor">
                    #{k}#
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
          <SaveBar saving={saving} editable={editable} />
        </form>
      )}
    </div>
  );
}

/** Settings > Self Service & Car Share SetUp > Welcome SMS (WelcomeSMSSetup.aspx). */
export function SelfServiceWelcomeSms() {
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const { loc, data, picker, queryKey } = useSetup();
  const [saving, setSaving] = React.useState(false);
  const [len, setLen] = React.useState<number | null>(null);
  const editable = can("AgreementFormsEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.selfService.saveSms.mutate({ locationId: loc, body: String(fd.get("body") ?? "") });
      await qc.invalidateQueries({ queryKey });
      toast.success("Welcome SMS saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="max-w-md"><CardContent>{picker}</CardContent></Card>
      {data && (
        <form key={loc} onSubmit={save} className="max-w-3xl space-y-4">
          <Card>
            <CardContent>
              <fieldset disabled={!editable}>
                <F label="SMS Body" name="body" hint={`${len ?? data.welcomeSms.length} characters (one text is 160).`}>
                  <Textarea id="body" name="body" rows={6} maxLength={1000} defaultValue={data.welcomeSms} onChange={(e) => setLen(e.target.value.length)} />
                </F>
              </fieldset>
            </CardContent>
          </Card>
          <SaveBar saving={saving} editable={editable} />
        </form>
      )}
    </div>
  );
}
