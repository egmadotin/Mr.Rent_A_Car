"use client";

/* eslint-disable @next/next/no-img-element -- uploaded images are served by /api/files */
import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, ExternalLinkIcon, ImagePlusIcon, Loader2Icon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { ListExportButtons, ListStatusRow, exportCsv } from "../../../../_components/list-kit";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const SKINS = ["Default", "Black", "Sunset", "Vista"] as const;
const fileUrl = (key: string) => `/api/files/${key}`;

function SaveBar({ saving, editable, title }: { saving: boolean; editable: boolean; title?: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" asChild><Link href="/admin/settings">Cancel</Link></Button>
      <Button type="submit" disabled={saving || !editable} title={editable ? undefined : title ?? NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}

/** Browse / Show / Remove for one image (Background Image, Image Logo); the key goes in a hidden field. */
function ImageField({ label, name, initial, disabled }: { label: string; name: string; initial: string | null; disabled: boolean }) {
  const [key, setKey] = React.useState<string | null>(initial);
  const [busy, setBusy] = React.useState(false);
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", f);
      body.append("folder", "logos");
      const res = await fetch("/api/files", { method: "POST", body });
      const json = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !json.key) throw new Error(json.error ?? "Upload failed");
      setKey(json.key);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium">{label} <span className="font-normal text-muted-foreground">(only .jpg, .png, .webp or .gif)</span></span>
      <input type="hidden" name={name} value={key ?? ""} />
      <div className="flex flex-wrap items-center gap-2">
        {key && (
          <a href={fileUrl(key)} target="_blank" rel="noreferrer" className="block h-12 w-20 overflow-hidden rounded border bg-muted" title="Show">
            <img src={fileUrl(key)} alt={label} className="size-full object-contain" />
          </a>
        )}
        <label className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${disabled ? "opacity-50" : "cursor-pointer hover:bg-accent"}`}>
          {busy ? <Loader2Icon className="size-4 animate-spin" /> : <ImagePlusIcon className="size-4" />} Browse
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {key && !disabled && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setKey(null)}><XIcon /> Remove</Button>
        )}
      </div>
    </div>
  );
}

/** Settings > Website & Email Setup > Website Design V3 (WebCustomerWebsiteDesign.aspx "Style & Format"). */
export function WebsiteDesignSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.website.designGet.queryOptions());
  const [saving, setSaving] = React.useState(false);
  const editable = !!can.me?.isAdmin;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.website.designSave.mutate({
        backgroundColor: str(fd, "backgroundColor").toUpperCase(), textColor: str(fd, "textColor").toUpperCase(),
        displaySkin: str(fd, "displaySkin") as (typeof SKINS)[number], calendarSkin: str(fd, "calendarSkin") as (typeof SKINS)[number],
        backgroundImageKey: str(fd, "backgroundImageKey") || null, logoKey: str(fd, "logoKey") || null, compactWidth: Math.max(0, Math.round(Number(str(fd, "compactWidth")) || 0)),
        homePageBody: str(fd, "homePageBody"), headerHtml: str(fd, "headerHtml"), footerHtml: str(fd, "footerHtml"), stylesheet: str(fd, "stylesheet"),
        analyticsCode: str(fd, "analyticsCode"), conversionCode: str(fd, "conversionCode"),
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.website.designGet.queryKey() });
      toast.success("Website Design saved — live on the website now");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const d = q.data;
  if (!d) return null;
  const code = (name: keyof typeof d, label: string, hint: string, rows = 8) => (
    <F label={label} name={name} hint={hint}>
      <Textarea id={name} name={name} rows={rows} className="font-mono text-xs" defaultValue={String(d[name] ?? "")} spellCheck={false} />
    </F>
  );
  return (
    <form onSubmit={save} className="space-y-4 p-4 md:p-6">
      {!editable && <p className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-sm">Only admins can change the website design: its code fields run on mrrentacar.com.</p>}
      <fieldset disabled={!editable} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Web Site Design</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <F label="Background Color" name="backgroundColor"><Input id="backgroundColor" name="backgroundColor" type="color" defaultValue={d.backgroundColor ?? "#FFFFFF"} className="h-9 p-1" /></F>
              <F label="Text Color" name="textColor"><Input id="textColor" name="textColor" type="color" defaultValue={d.textColor ?? "#000000"} className="h-9 p-1" /></F>
              <F label="Display Skin" name="displaySkin"><NativeSelect id="displaySkin" name="displaySkin" defaultValue={d.displaySkin}>{SKINS.map((s) => <option key={s}>{s}</option>)}</NativeSelect></F>
              <F label="Calendar Skin" name="calendarSkin"><NativeSelect id="calendarSkin" name="calendarSkin" defaultValue={d.calendarSkin}>{SKINS.map((s) => <option key={s}>{s}</option>)}</NativeSelect></F>
              <ImageField label="Background Image" name="backgroundImageKey" initial={d.backgroundImageKey} disabled={!editable} />
              <ImageField label="Image Logo" name="logoKey" initial={d.logoKey} disabled={!editable} />
              <F label="Compact Web Customer Width" name="compactWidth"><Input id="compactWidth" name="compactWidth" type="number" min={0} defaultValue={d.compactWidth} /></F>
            </div>
            <p className="text-xs text-muted-foreground">Colours, skins, images and width styled RentCentric&apos;s hosted booking pages; they are kept here, while mrrentacar.com uses its own design.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            {code("homePageBody", "Home Page Body", "HTML shown on the home page, under the booking search (leave empty for none).", 10)}
            <div className="grid gap-4 lg:grid-cols-2">
              {code("headerHtml", "Header HTML", "HTML shown at the top of every page of the website, under the menu (e.g. a notice).")}
              {code("footerHtml", "Footer HTML", "HTML shown at the bottom of every page, above the footer.")}
            </div>
            {code("stylesheet", "Stylesheet", "CSS added to every page of the website.")}
            <div className="grid gap-4 lg:grid-cols-2">
              {code("analyticsCode", "Google Analytics Code", "The <script> snippet from Google Analytics; runs on every page.")}
              {code("conversionCode", "Google Conversion Code", "The conversion <script>; runs on the booking confirmation page.")}
            </div>
          </CardContent>
        </Card>
      </fieldset>
      <SaveBar saving={saving} editable={editable} title="Only admins can change this" />
    </form>
  );
}

type WebPageRow = { id: string; type: string; target: string; url: string | null; title: string; content: string; isActive: boolean };
const TARGETS = ["_blank", "_parent", "_search", "_self", "_top"] as const;

function WebPageDialog({ page, open, onOpenChange }: { page: WebPageRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const [type, setType] = React.useState(page?.type ?? "LINK");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setType(page?.type ?? "LINK"), [page, open]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.website.pageSave.mutate({
        id: page?.id, type: type as "LINK" | "PAGE", target: str(fd, "target") as (typeof TARGETS)[number], url: str(fd, "url"), title: str(fd, "title"), content: str(fd, "content"), isActive: fd.get("isActive") === "on",
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.website.pages.queryKey() });
      toast.success("Web page saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{page ? "Edit Web Page" : "Add Web Page"}</DialogTitle></DialogHeader>
        <form key={page?.id ?? "new"} onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="External Link and Webpage" name="type">
              <NativeSelect id="type" value={type} onChange={(e) => setType(e.target.value)}><option value="LINK">External Link</option><option value="PAGE">Webpage</option></NativeSelect>
            </F>
            <F label="Target" name="target">
              <NativeSelect id="target" name="target" defaultValue={page?.target ?? "_parent"}>{TARGETS.map((t) => <option key={t}>{t}</option>)}</NativeSelect>
            </F>
          </div>
          {type === "LINK" && (
            <F label="External Link Address (e.g. http://www.yahoo.com/)" name="url" required><Input id="url" name="url" defaultValue={page?.url ?? ""} placeholder="http://" /></F>
          )}
          <F label="Title" name="title" required><Input id="title" name="title" defaultValue={page?.title ?? ""} /></F>
          {type === "PAGE" && (
            <F label="Page content (HTML)" name="content"><Textarea id="content" name="content" rows={12} className="font-mono text-xs" defaultValue={page?.content ?? ""} /></F>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={page?.isActive ?? true} className="size-4" /> Is Active</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Settings > Website & Email Setup > Add/Edit Webpages (WebPagesMain.aspx). */
export function WebPagesSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.website.pages.queryOptions());
  const [edit, setEdit] = React.useState<{ page: WebPageRow | null } | null>(null);
  const [del, setDel] = React.useState<WebPageRow | null>(null);
  const editable = can("Settings");
  const rows = q.data ?? [];
  const href = (p: WebPageRow) => (p.type === "PAGE" ? `/pages/${p.id}` : p.url ?? "");

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-end">
        <Button onClick={() => setEdit({ page: null })} disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Web Page</Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead><TableHead>External Link Address</TableHead><TableHead>Target</TableHead><TableHead>External Link and Webpage</TableHead><TableHead>Is Active</TableHead><TableHead className="w-16 text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={6} loading={q.isLoading} empty={!rows.length} emptyText="No web pages yet." />
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <button type="button" className="font-medium text-primary hover:underline disabled:text-foreground disabled:no-underline" disabled={!editable} onClick={() => setEdit({ page: p })}>{p.title || "(no title)"}</button>
                </TableCell>
                <TableCell><a href={href(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{href(p)} <ExternalLinkIcon className="size-3" /></a></TableCell>
                <TableCell>{p.target}</TableCell>
                <TableCell>{p.type === "PAGE" ? "Webpage" : "Link"}</TableCell>
                <TableCell>{p.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${p.title}`} disabled={!editable} onClick={() => setDel(p)}><Trash2Icon className="text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListExportButtons onExport={() => exportCsv("web-pages.csv", ["Title", "External Link Address", "Target", "External Link and Webpage", "Is Active"], rows.map((p) => [p.title, href(p), p.target, p.type === "PAGE" ? "Webpage" : "Link", p.isActive ? "Yes" : "No"]))} />
      <p className="text-xs text-muted-foreground">Active links and pages are listed in the website footer under &quot;More&quot;; a Webpage opens at mrrentacar.com/pages/…</p>
      <WebPageDialog page={edit?.page ?? null} open={!!edit} onOpenChange={(o) => !o && setEdit(null)} />
      <ConfirmAction
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.title || "this web page"}?`}
        description="It comes off the website. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await client.staff.website.pageDelete.mutate({ id: del!.id });
            await qc.invalidateQueries({ queryKey: trpc.staff.website.pages.queryKey() });
            toast.success("Web page deleted");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function CopyLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-start gap-2">
        <code className="flex-1 rounded border bg-muted px-2 py-1.5 font-mono text-xs break-all">{text}</code>
        <Button type="button" size="icon-sm" variant="outline" aria-label={`Copy ${label}`} onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}><CopyIcon /></Button>
      </div>
    </div>
  );
}

/** Settings > Website & Email Setup > Widget/Rotator Setup (WidgetSetup.aspx). */
export function WidgetSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.website.widgetGet.queryOptions());
  const [saving, setSaving] = React.useState(false);
  const editable = can("Settings");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.website.widgetSave.mutate({ widgetTarget: str(fd, "widgetTarget") as "_blank", rotatorTarget: str(fd, "rotatorTarget") as "_blank" });
      await qc.invalidateQueries({ queryKey: trpc.staff.website.widgetGet.queryKey() });
      toast.success("Widget/Rotator Setup saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const d = q.data;
  if (!d) return null;
  const targets = [["_blank", "Pop up"], ["_self", "Current Window"], ["_parent", "Parent"]] as const;
  return (
    <form onSubmit={save} className="space-y-4 p-4 md:p-6">
      <Card className="max-w-2xl">
        <CardContent>
          <fieldset disabled={!editable} className="space-y-5">
            <div className="space-y-3">
              <div className="text-sm">Your Online Widget Link:<br /><a href={d.widgetUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.widgetUrl}</a></div>
              <div className="text-sm">Online Reservation page:<br /><span className="text-muted-foreground">{d.bookingUrl}</span> <span className="text-xs text-muted-foreground">(the widget&apos;s Search opens the website&apos;s vehicle results)</span></div>
              <F label="Target" name="widgetTarget">
                <NativeSelect id="widgetTarget" name="widgetTarget" defaultValue={d.widgetTarget}>{targets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
              </F>
            </div>
            <div className="space-y-3">
              <div className="text-sm">Your Online Rotator Link:<br /><a href={d.rotatorUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.rotatorUrl}</a></div>
              <F label="Target" name="rotatorTarget">
                <NativeSelect id="rotatorTarget" name="rotatorTarget" defaultValue={d.rotatorTarget}>{targets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
              </F>
            </div>
          </fieldset>
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Put them on another website</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <CopyLine label="Booking widget" text={`<iframe src="${d.widgetUrl}" width="340" height="460" style="border:0" title="Book a car — Mr. Rent A Car"></iframe>`} />
          <CopyLine label="Vehicle rotator" text={`<iframe src="${d.rotatorUrl}" width="340" height="300" style="border:0" title="Our vehicles — Mr. Rent A Car"></iframe>`} />
        </CardContent>
      </Card>
      <div className="max-w-2xl"><SaveBar saving={saving} editable={editable} /></div>
    </form>
  );
}
