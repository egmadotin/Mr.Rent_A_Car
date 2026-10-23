"use client";

import * as React from "react";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { TableCell, TableRow } from "@mrac/ui/components/table";
import { ErpIcon } from "@mrac/ui/components/erp-icon";
import { cn } from "@mrac/ui/lib/utils";

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

/** "12/13/2024 2:46 PM" (or with seconds), the date format of the RentCentric search lists. */
export function legacyDate(d: Date | string | null | undefined, { seconds = false, timeZone }: { seconds?: boolean; timeZone?: string } = {}) {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
  })
    .format(new Date(d))
    .replace(",", "");
}

/** "Export to Excel": downloads the rows as a CSV that Excel opens. */
export function exportCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * The RentCentric search bar: "Advanced Search" toggle + quick search box + Search; the advanced fields
 * (children) open underneath with their own Search. Both submit; filters apply on Search, not while typing.
 */
export function LegacySearchBar({
  placeholder,
  quick,
  onQuickChange,
  onSearch,
  children,
}: {
  placeholder: string;
  quick: string;
  onQuickChange: (v: string) => void;
  onSearch: (mode: "quick" | "advanced") => void;
  children: React.ReactNode;
}) {
  const [advanced, setAdvanced] = React.useState(false);
  return (
    <Card className="gap-0 p-3 print:hidden">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch("quick");
        }}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => setAdvanced((x) => !x)}
          aria-expanded={advanced}
        >
          Advanced search <ChevronDownIcon className={cn("transition-transform", advanced && "rotate-180")} />
        </Button>
        <Input
          className="min-w-64 flex-1"
          value={quick}
          onChange={(e) => onQuickChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <Button type="submit" variant="ink" className="px-5">
          Search
        </Button>
      </form>
      {advanced && (
        <form
          className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch("advanced");
          }}
        >
          {children}
          <div className="flex items-end">
            <Button type="submit" variant="ink" className="w-full">
              Search
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** One labelled field in the Advanced Search panel. */
export function SearchField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Print / Export to Excel under a list. */
export function ListExportButtons({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
      >
        <ErpIcon name="print" size={15} /> Print
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
      >
        <ErpIcon name="download" size={15} /> Export to Excel
      </Button>
    </div>
  );
}
