"use client";

import { usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@mrac/ui/components/native-select";

/** "Please Select … Printout": switch the template the page is printed with ("" = the built-in layout, when offered). */
export function TemplatePicker({ current, names, builtIn }: { current: string; names: string[]; builtIn?: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <label className="flex items-center gap-2 text-sm">
      Printout
      <NativeSelect className="w-64" value={current} onChange={(e) => router.replace(e.target.value ? `${path}?t=${encodeURIComponent(e.target.value)}` : path)}>
        {builtIn && <option value="">{builtIn}</option>}
        {current && !names.includes(current) ? <option>{current}</option> : null}
        {names.map((n) => <option key={n}>{n}</option>)}
      </NativeSelect>
    </label>
  );
}
