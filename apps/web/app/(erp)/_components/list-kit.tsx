"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@mrac/ui/components/input";
import { TableCell, TableRow } from "@mrac/ui/components/table";

/**
 * Shared state for the paged, searchable ERP lists: a debounced search box and paging that jumps
 * back to page 1 whenever the search or any of `filters` changes.
 */
export function useListState(filters: unknown[] = []) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [paging, setPaging] = React.useState({ page: 1, pageSize: 25 });
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is the caller's list of reset triggers
  React.useEffect(() => setPaging((p) => ({ ...p, page: 1 })), [debounced, ...filters]);
  return { search, setSearch, query: debounced || undefined, paging, setPaging };
}

export function ListSearch({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" aria-label={label} />
    </div>
  );
}

/** The "Loading…" / "No X match." row shown in place of table rows. */
export function ListStatusRow({ colSpan, loading, empty, emptyText }: { colSpan: number; loading: boolean; empty: boolean; emptyText: string }) {
  if (!loading && !empty) return null;
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {loading ? "Loading…" : emptyText}
      </TableCell>
    </TableRow>
  );
}
