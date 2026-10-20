"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > Inspection Email (InspectionCustomerEmail.aspx): Subject and the email body (HTML). */
export function InspectionEmailSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.inspections.inspectionEmailGet.queryOptions());
  const [saving, setSaving] = React.useState(false);
  if (!q.data) return null;
  const editable = can("AgreementFormsEdit");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.inspections.inspectionEmailSave.mutate({ subject: String(fd.get("subject") ?? ""), body: String(fd.get("body") ?? "") });
      await qc.invalidateQueries({ queryKey: trpc.staff.inspections.inspectionEmailGet.queryKey() });
      toast.success("Inspection Email saved");
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
              <F label="Email (HTML)" name="body"><Textarea id="body" name="body" rows={14} className="font-mono text-xs" defaultValue={q.data.body} /></F>
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
