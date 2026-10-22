"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/** Settings > Rental Policies (WebCustomerRentalPolicies.aspx): the Master Policies text (HTML), with a preview. */
export function RentalPoliciesSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery(trpc.staff.inspections.rentalPoliciesGet.queryOptions());
  const [text, setText] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  if (q.data === undefined) return null;
  const editable = can("AgreementFormsEdit");
  const value = text ?? q.data;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await client.staff.inspections.rentalPoliciesSave.mutate({ text: value });
      await qc.invalidateQueries({ queryKey: trpc.staff.inspections.rentalPoliciesGet.queryKey() });
      toast.success("Rental Policies saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="max-w-3xl">
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <fieldset disabled={!editable}>
              <F label="Master Policies (HTML)" name="policies"><Textarea id="policies" rows={12} className="font-mono text-xs" value={value} onChange={(e) => setText(e.target.value)} /></F>
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="max-w-3xl">
        <CardContent>
          <p className="mb-2 text-sm font-semibold">Preview</p>
          <div className="space-y-2 text-sm" dangerouslySetInnerHTML={{ __html: value }} />
        </CardContent>
      </Card>
    </div>
  );
}
