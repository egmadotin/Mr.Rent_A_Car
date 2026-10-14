"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@mrac/ui/components/input";

export type PickerItem = { id: string; label: string; hint?: React.ReactNode };

/**
 * The RentCentric search-box pickers (Company, Vehicle …): type to filter, pick from the list, ✕ to clear.
 * `extra` lets a caller keep a current value that is not in `items` (e.g. the vehicle already assigned).
 */
export function SearchPicker({
  id,
  items,
  value,
  onChange,
  disabled,
  placeholder,
  emptyText = "No matches",
}: {
  id: string;
  items: PickerItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
}) {
  const selected = items.find((c) => c.id === value);
  const [q, setQ] = React.useState(selected?.label ?? "");
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setQ(selected?.label ?? ""), [selected?.label]);
  const needle = q.trim().toLowerCase();
  // empty box or the chosen label = show everything; otherwise filter
  const matches = (!needle || needle === selected?.label.toLowerCase() ? items : items.filter((c) => c.label.toLowerCase().includes(needle))).slice(0, 50);

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="pr-8"
      />
      {value && !disabled ? (
        <button type="button" aria-label="Clear" onClick={() => { onChange(""); setQ(""); }} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      {open && !disabled && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {matches.length === 0 && <li className="px-2 py-1.5 text-muted-foreground">{emptyText}</li>}
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={c.id === value}>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id);
                  setQ(c.label);
                  setOpen(false);
                }}
              >
                {c.label}
                {c.hint && <span className="ml-1 text-muted-foreground">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
