"use client";

import { usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@mrac/ui/components/native-select";

/** "Please Select Rental Printout": switch the template the page is printed with. */
export function TemplatePicker({ current, names }: { current: string; names: string[] }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm">
      Printout
      <NativeSelect className="w-64" value={current} onChange={(e) => router.replace(`${path}?t=${encodeURIComponent(e.target.value)}`)}>
        {names.includes(current) ? null : <option>{current}</option>}
        {names.map((n) => <option key={n}>{n}</option>)}
      </NativeSelect>
    </label>
  );
}
