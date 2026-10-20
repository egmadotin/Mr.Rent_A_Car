"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { CheckField, Field, FormDialog, PAYMENT_METHOD_OPTIONS, errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { RowActions } from "../../../../_components/row-actions";

/**
 * Settings > Payment Settings: Payment Methods (PayMethodsMain / PayMethodsAdd: Payment Method, Credit Card, Credit Card
 * Type, Default, Is Mobile Agent Included) and Default Payment Method — per location.
 */
export function PaymentMethodsSettings() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const editable = can("Settings");
  const locations = (useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? []).filter((l) => l.isActive);
  const [locationId, setLocationId] = React.useState("");
  const loc = locationId || locations[0]?.id || "";
  const q = useQuery({ ...trpc.staff.setup.paymentMethodList.queryOptions({ locationId: loc }), enabled: !!loc });
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.staff.setup.paymentMethodList.queryKey({ locationId: loc }) }),
      qc.invalidateQueries({ queryKey: trpc.staff.setup.paymentMethodOptions.queryKey() }),
    ]);
  type M = NonNullable<typeof q.data>["methods"][number];
  const fields = (m?: M) => (
    <>
      <Field label="Payment Method" name="name" required defaultValue={m?.name ?? ""} />
      <Field label="Credit Card Type" name="creditCardType" defaultValue={m?.creditCardType ?? ""} />
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <CheckField label="Credit Card" name="isCreditCard" defaultChecked={m?.isCreditCard} />
        <CheckField label="Default" name="isDefault" defaultChecked={m?.isDefault} />
        <CheckField label="Is Mobile Agent Included" name="mobileAgentIncluded" defaultChecked={m?.mobileAgentIncluded} />
        <CheckField label="Active" name="isActive" defaultChecked={m?.isActive ?? true} />
      </div>
    </>
  );
  const save = async (v: Record<string, unknown>, id?: string) => {
    await client.staff.setup.paymentMethodSave.mutate({
      id, locationId: loc, name: v.name as string, creditCardType: (v.creditCardType as string) ?? null,
      isCreditCard: !!v.isCreditCard, isDefault: !!v.isDefault, mobileAgentIncluded: !!v.mobileAgentIncluded, isActive: !!v.isActive,
    });
    toast.success("Payment method saved");
    await refresh();
  };
  const all = [...PAYMENT_METHOD_OPTIONS, ...(q.data?.methods ?? []).filter((m) => m.isActive).map((m) => ({ value: `OTHER:${m.name}`, label: m.name }))];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="max-w-md space-y-1">
        <Label htmlFor="pm-loc">Location</Label>
        <NativeSelect id="pm-loc" value={loc} onChange={(e) => setLocationId(e.target.value)}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </NativeSelect>
      </div>

      <Card className="max-w-2xl gap-2 py-4">
        <CardHeader className="px-4"><CardTitle className="text-base">Default Payment Method</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 px-4">
          <div className="min-w-64 flex-1 space-y-1">
            <Label htmlFor="pm-default">Please select the default payment method</Label>
            <NativeSelect
              id="pm-default"
              value={q.data?.defaultMethod ?? ""}
              disabled={!editable || !loc}
              onChange={(e) =>
                client.staff.setup.paymentMethodSetDefault.mutate({ locationId: loc, method: e.target.value || null }).then(
                  () => refresh().then(() => toast.success("Default payment method saved")),
                  (err) => toast.error(errorMessage(err)),
                )
              }
            >
              <option value="">-NONE-</option>
              {all.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle className="text-base">Payment Methods</CardTitle>
          {editable ? (
            <FormDialog title="Add payment method" trigger={<Button size="sm"><PlusIcon /> Add New</Button>} onSubmit={(v) => save(v)}>{fields()}</FormDialog>
          ) : (
            <Button size="sm" disabled title={NO_PERMISSION}><PlusIcon /> Add New</Button>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <p className="px-4 pb-2 text-xs text-muted-foreground">This location&apos;s own methods, offered after the built-in ones ({PAYMENT_METHOD_OPTIONS.map((o) => o.label).join(", ")}).</p>
          <Table>
            <TableHeader><TableRow><TableHead>Payment Method</TableHead><TableHead>Credit Card</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {q.data?.methods.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No Records Found</TableCell></TableRow>}
              {q.data?.methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name} {m.isDefault && <Badge variant="muted">Default</Badge>}</TableCell>
                  <TableCell>{m.isCreditCard ? m.creditCardType || "Yes" : ""}</TableCell>
                  <TableCell>{m.isActive ? "Active" : <Badge variant="muted">Inactive</Badge>}</TableCell>
                  <TableCell>
                    <RowActions label={m.name} canEdit={editable} canDelete={editable} editTitle="Edit payment method" onSave={(v) => save(v, m.id)} onDelete={() => client.staff.setup.paymentMethodDelete.mutate({ id: m.id }).then(refresh)}>
                      {fields(m)}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
