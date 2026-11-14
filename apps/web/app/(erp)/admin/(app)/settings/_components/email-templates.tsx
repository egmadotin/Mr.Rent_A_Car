"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { Textarea } from "@mrac/ui/components/textarea";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

type Draft = { id?: string; subject: string; fromName: string; fromEmail: string; body: string };
const EMPTY: Draft = { subject: "", fromName: "", fromEmail: "", body: "" };

/** Settings > Email Marketing > Email Template (EmailTemplatesMain.aspx): Subject · From (Name) · From (Email), Add New / edit / delete. */
export function EmailTemplates() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const editable = can("Settings");
  const list = useQuery(trpc.staff.marketing.templates.queryOptions());
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await client.staff.marketing.saveTemplate.mutate(draft);
      toast.success("Template saved");
      setDraft(null);
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await client.staff.marketing.removeTemplate.mutate({ id });
      await list.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {!editable && <p className="text-sm text-muted-foreground">{NO_PERMISSION}</p>}
      {draft ? (
        <Card className="max-w-3xl">
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="t-subject">Subject *</Label><Input id="t-subject" value={draft.subject} onChange={set("subject")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="t-fromName">From (Name)</Label><Input id="t-fromName" value={draft.fromName} onChange={set("fromName")} /></div>
              <div className="space-y-1.5"><Label htmlFor="t-fromEmail">From (Email)</Label><Input id="t-fromEmail" type="email" value={draft.fromEmail} onChange={set("fromEmail")} placeholder="Email Setup's when blank" /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-body">Email * <span className="font-normal text-muted-foreground">(plain text or HTML)</span></Label>
              <Textarea id="t-body" rows={14} className="font-mono text-xs" value={draft.body} onChange={set("body")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="button" disabled={busy || !draft.subject.trim() || !draft.body.trim()} onClick={save}>{busy && <Loader2Icon className="animate-spin" />}Save</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        editable && <Button type="button" onClick={() => setDraft({ ...EMPTY })}><PlusIcon /> Add New</Button>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Subject</th><th className="px-4 py-2 font-medium">From (Name)</th><th className="px-4 py-2 font-medium">From (Email)</th><th className="w-24" /></tr>
            </thead>
            <tbody>
              {!list.data?.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">{list.isLoading ? "Loading…" : "No templates yet."}</td></tr>}
              {list.data?.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.subject}</td>
                  <td className="px-4 py-2">{t.fromName}</td>
                  <td className="px-4 py-2">{t.fromEmail}</td>
                  <td className="px-2 text-right whitespace-nowrap">
                    {editable && (
                      <>
                        <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ id: t.id, subject: t.subject, fromName: t.fromName ?? "", fromEmail: t.fromEmail ?? "", body: t.body })}><PencilIcon className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Delete" onClick={() => void remove(t.id)}><Trash2Icon className="size-4" /></Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
