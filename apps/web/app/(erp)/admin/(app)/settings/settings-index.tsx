"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";

export type SettingsCategory = { title: string; items: { label: string; href?: string; desc?: string }[] };

/** Fixes the legacy "80+ links, no search" problem: one filter across every category and page. */
export function SettingsIndex({ categories }: { categories: SettingsCategory[] }) {
  const [q, setQ] = React.useState("");
  const [builtOnly, setBuiltOnly] = React.useState(false);
  const needle = q.trim().toLowerCase();
  const shown = categories
    .map((c) => ({
      ...c,
      items: c.items.filter(
        (i) => (!builtOnly || i.href) && (!needle || `${c.title} ${i.label} ${i.desc ?? ""}`.toLowerCase().includes(needle)),
      ),
    }))
    .filter((c) => c.items.length);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings (e.g. tax, insurance, seasons)…" className="pl-8" aria-label="Search settings" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={builtOnly} onChange={(e) => setBuiltOnly(e.target.checked)} />
          Only pages available now
        </label>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No settings match “{q}”.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <Card key={c.title} className="gap-2 pb-2">
            <CardHeader><CardTitle>{c.title}</CardTitle></CardHeader>
            <CardContent className="px-2">
              <ul>
                {c.items.map((i) =>
                  i.href ? (
                    <li key={i.label}>
                      <Link href={i.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{i.label}</span>
                          {i.desc && <span className="block truncate text-xs text-muted-foreground">{i.desc}</span>}
                        </span>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ) : (
                    <li key={i.label} className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <span className="flex-1">{i.label}</span>
                      <Badge variant="muted">Not built yet</Badge>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
