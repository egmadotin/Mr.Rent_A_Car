"use client";

import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { NativeSelect } from "@mrac/ui/components/native-select";

/**
 * One pagination pattern for every list (legacy mixed "Page x of y + size" with bare ">/>>" on Customers).
 * Page sizes match legacy: 25 / 50 / 100 / 200.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (next: { page: number; pageSize: number }) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Rows
          <NativeSelect
            className="h-8 w-20"
            value={pageSize}
            onChange={(e) => onChange({ page: 1, pageSize: Number(e.target.value) })}
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange({ page: 1, pageSize })} aria-label="First page">
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange({ page: page - 1, pageSize })} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onChange({ page: page + 1, pageSize })} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onChange({ page: pages, pageSize })} aria-label="Last page">
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
