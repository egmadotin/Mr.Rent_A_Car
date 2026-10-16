"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { NativeSelect } from "@mrac/ui/components/native-select";

/**
 * "Please Select Rental Printout": the location's active agreement templates (Settings > Rentals & Invoices),
 * preselecting its default. `value` / `onChange` hold the template name.
 */
export function PrintoutSelect({ locationId, value, onChange, id = "printout" }: { locationId?: string; value: string; onChange: (name: string) => void; id?: string }) {
  const trpc = useTRPC();
  const list = useQuery({ ...trpc.staff.template.list.queryOptions({ kind: "AGREEMENT", locationId, activeOnly: true }), enabled: !!locationId }).data;
  React.useEffect(() => {
    if (!list?.length) return;
    if (!value || !list.some((t) => t.name === value)) onChange((list.find((t) => t.isDefault) ?? list[0])!.name);
  }, [list, value, onChange]);
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {!list?.length && <option value="">{list ? "No templates set up" : "Loading…"}</option>}
      {list?.map((t) => <option key={t.id}>{t.name}</option>)}
    </NativeSelect>
  );
}
