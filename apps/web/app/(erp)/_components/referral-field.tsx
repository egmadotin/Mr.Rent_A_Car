"use client";

import * as React from "react";
import { PlusCircleIcon } from "lucide-react";
import { useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Field, FormDialog, TextareaField } from "./form";

type Referral = { id: string; name: string };

/** RentCentric "Referral": a list (None + referrals) with ⊕ opening Quick Referral Add (ReferralsQuickAdd.aspx). */
export function ReferralField({ id = "referralId", referrals, value, onChange }: { id?: string; referrals: Referral[]; value: string; onChange: (referralId: string) => void }) {
  const client = useTRPCClient();
  const [added, setAdded] = React.useState<Referral[]>([]);
  const all = [...referrals, ...added.filter((a) => !referrals.some((r) => r.id === a.id))].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex items-center gap-2">
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
        <option value="">None</option>
        {all.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </NativeSelect>
      <FormDialog
        title="Quick Referral Add"
        wide
        trigger={<Button type="button" size="icon-sm" variant="ghost" aria-label="Add referral"><PlusCircleIcon /></Button>}
        onSubmit={async (v) => {
          const r = await client.staff.meta.referralQuickAdd.mutate(v as never);
          setAdded((a) => [...a, r]);
          onChange(r.id);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Referral/Company Name" name="name" required />
          <Field label="Full Name" name="fullName" />
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Fax" name="fax" type="tel" />
          <TextareaField label="Memo" name="memo" rows={3} />
        </div>
      </FormDialog>
    </div>
  );
}
