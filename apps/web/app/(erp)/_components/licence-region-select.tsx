"use client";

import * as React from "react";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { REGION_OPTIONS, regionsOf } from "@mrac/ui/lib/regions";

const PREF = "mrac:licence-region-same-country";

/**
 * Licence State with a tick box in front (client request, Nov 16): ticked, the list shows only the provinces / states of
 * the address country (a licence is usually issued where the renter lives), so Canada → the 13 provinces and
 * territories, no US states. Untick for the full list. The choice is remembered on this computer. A value already on
 * the record stays in the list even when it's from elsewhere.
 */
export function LicenceRegionSelect({ country, ...props }: { country?: string | null } & React.ComponentProps<"select">) {
  const [only, setOnly] = React.useState(true);
  React.useEffect(() => {
    try {
      if (localStorage.getItem(PREF) === "0") setOnly(false);
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  const own = regionsOf(country);
  const current = String(props.value ?? props.defaultValue ?? "");
  const base = only && own ? own : REGION_OPTIONS;
  const list = current && !base.includes(current) ? [current, ...base] : base;
  const tip = own ? `Only ${country} provinces / states` : country ? `No province list for ${country}` : "Enter the address country first";
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        aria-label={tip}
        title={`${tip}. Untick to show every province / state.`}
        checked={only && !!own}
        disabled={!own}
        onChange={(e) => {
          setOnly(e.target.checked);
          try {
            localStorage.setItem(PREF, e.target.checked ? "1" : "0");
          } catch {
            /* ignore */
          }
        }}
      />
      <div className="min-w-0 flex-1">
        <NativeSelect {...props}>
          <option value="">Please select</option>
          {list.map((r) => <option key={r}>{r}</option>)}
        </NativeSelect>
      </div>
    </div>
  );
}
