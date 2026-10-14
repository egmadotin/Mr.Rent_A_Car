"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@mrac/ui/components/input";

type Company = { id: string; name: string; isUndesired?: boolean };

/** RentCentric "Company" field: a search box (type to find a company), not a dropdown. */
export function CompanySearch({
  id = "companyId",
  companies,
  value,
  onChange,
}: {
  id?: string;
  companies: Company[];
  value: string;
  onChange: (companyId: string) => void;
}) {
  const selected = companies.find((c) => c.id === value);
  const [q, setQ] = React.useState(selected?.name ?? "");
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setQ(selected?.name ?? ""), [selected?.name]);
  const needle = q.trim().toLowerCase();
  const matches = needle && needle !== selected?.name.toLowerCase() ? companies.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 20) : [];

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        autoComplete="off"
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
      {value ? (
        <button type="button" aria-label="Clear company" onClick={() => { onChange(""); setQ(""); }} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          <XIcon className="size-4" />
        </button>
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      {open && matches.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={c.id === value}>
              <button
                type="button"
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id);
                  setQ(c.name);
                  setOpen(false);
                }}
              >
                {c.name}
                {c.isUndesired && <span className="ml-1 text-destructive">(undesired)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
