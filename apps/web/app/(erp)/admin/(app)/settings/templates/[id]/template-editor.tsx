"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EyeIcon, Loader2Icon, SaveIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { FormAlert } from "../../../../../_components/booking-kit";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../../_components/form";

type T = { id?: string; name: string; kind: string; locationId: string | null; html: string; isActive: boolean; isDefault: boolean; autoPrint: boolean; emailFriendly: boolean };

/**
 * Template editor (AgreementFormsModify.aspx): settings, the HTML with RentCentric's ##code## placeholders, a searchable
 * placeholder list (click inserts at the cursor) and a live preview filled from a real rental. Only admins can save.
 */
export function TemplateEditor({ initial, locations, canEdit }: { initial: T; locations: { id: string; name: string }[]; canEdit: boolean }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const [v, setV] = React.useState<T>(initial);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [ra, setRa] = React.useState("");
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const fields = useQuery(trpc.staff.template.fields.queryOptions()).data ?? [];
  const set = <K extends keyof T>(k: K, val: T[K]) => setV((s) => ({ ...s, [k]: val }));
  const shown = q.trim() ? fields.filter((f) => `${f.name} ${f.code}`.toLowerCase().includes(q.trim().toLowerCase())) : fields;

  function insert(code: string) {
    const el = area.current;
    const token = `##${code}##`;
    if (!el) return set("html", v.html + token);
    const { selectionStart: a, selectionEnd: b } = el;
    set("html", v.html.slice(0, a) + token + v.html.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = a + token.length;
    });
  }

  async function preview() {
    if (!ra) return toast.error("Enter a Rental # to preview with.");
    try {
      const r = await client.staff.template.renderRental.query({ raNumber: Number(ra), html: v.html });
      if (!r.html) return toast.error(`Rental #${ra} not found.`);
      setPreviewHtml(r.html);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await client.staff.template.save.mutate({ ...v, kind: v.kind as "AGREEMENT" });
      toast.success("Template saved");
      if (!v.id) router.replace(`/admin/settings/templates/${res.id}`);
      else router.refresh();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={save} noValidate className="space-y-4 p-4 md:p-6">
        <FormAlert message={formError} />
        {!canEdit && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Only admins can change templates.</p>}
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <F label="Rental Name" name="name" required><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} /></F>
            <F label="Rental Type" name="kind">
              <NativeSelect id="kind" value={v.kind} onChange={(e) => set("kind", e.target.value)} disabled={!canEdit}>
                <option value="AGREEMENT">Agreement</option>
                <option value="RESERVATION">Reservation</option>
                <option value="QUOTE">Quote</option>
              </NativeSelect>
            </F>
            <F label="Location" name="locationId">
              <NativeSelect id="locationId" value={v.locationId ?? ""} onChange={(e) => set("locationId", e.target.value || null)} disabled={!canEdit}>
                <option value="">All locations</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </F>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2 text-sm">
              {(
                [["isActive", "Active"], ["isDefault", "Default"], ["autoPrint", "Auto Print"], ["emailFriendly", "Email Friendly"]] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2"><Checkbox checked={v[k]} onChange={(e) => set(k, e.target.checked)} disabled={!canEdit} /> {label}</label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="gap-2">
            <CardHeader><CardTitle className="text-base">HTML</CardTitle></CardHeader>
            <CardContent>
              <textarea
                ref={area}
                value={v.html}
                onChange={(e) => set("html", e.target.value)}
                readOnly={!canEdit}
                spellCheck={false}
                className="h-[28rem] w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
                aria-label="Template HTML"
              />
            </CardContent>
          </Card>
          <Card className="gap-2">
            <CardHeader><CardTitle className="text-base">Placeholders</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (e.g. Customer, Balance)" aria-label="Search placeholders" />
              <ul className="h-[24rem] overflow-y-auto rounded-md border text-xs">
                {shown.map((f) => (
                  <li key={f.code}>
                    <button type="button" disabled={!canEdit} onClick={() => insert(f.code)} className="flex w-full justify-between gap-2 px-2 py-1 text-left hover:bg-accent disabled:cursor-default">
                      <span>{f.name}</span>
                      <code className="text-muted-foreground">##{f.code}##</code>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canEdit && <Button type="submit" disabled={saving}>{saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save</Button>}
          <Input value={ra} onChange={(e) => setRa(e.target.value)} placeholder="Rental #" className="w-28" aria-label="Rental number to preview with" />
          <Button type="button" variant="outline" onClick={preview}><EyeIcon /> Preview</Button>
          {canEdit && v.id && (
            <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={() => setDeleting(true)}><Trash2Icon /> Delete</Button>
          )}
        </div>

        {previewHtml && (
          <Card className="gap-2">
            <CardHeader><CardTitle className="text-base">Preview — Rental #{ra}</CardTitle></CardHeader>
            <CardContent>
              {/* staff-authored template filled with a rental's data */}
              <div className="overflow-auto rounded-md border bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </CardContent>
          </Card>
        )}
      </form>
      <ConfirmAction
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title="Delete template"
        description={<>“{v.name}” will be removed. Rentals already printed are not affected.</>}
        confirmLabel="Delete"
        onConfirm={async () => {
          await client.staff.template.delete.mutate({ id: v.id! });
          toast.success("Template deleted");
          router.push("/admin/settings/templates");
        }}
      />
    </FormErrorsContext.Provider>
  );
}
