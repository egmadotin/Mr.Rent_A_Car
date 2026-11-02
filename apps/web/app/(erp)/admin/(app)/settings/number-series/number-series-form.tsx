"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "../../../../_components/form";

const KINDS = [
  { kind: "quote", field: "quoteNumberStart", label: "Quotes" },
  { kind: "reservation", field: "reservationNumberStart", label: "Reservations" },
  { kind: "rental", field: "rentalNumberStart", label: "Rental agreements" },
] as const;
type Field = (typeof KINDS)[number]["field"];
type Draft = Record<Field, string>;

/**
 * Settings > Location Information > Number Series: one row per location with its starting number for each document.
 * A location numbers from its start up to the next higher start; blank = the shared numbers below every start.
 */
export function NumberSeriesForm() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const q = useQuery(trpc.staff.numberSeries.list.queryOptions());
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  if (q.error) return <p className="p-6 text-sm text-destructive">{q.error.message}</p>;
  if (!q.data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const { rows, isAdmin } = q.data;

  const saved = (r: (typeof rows)[number]): Draft =>
    Object.fromEntries(KINDS.map(({ kind, field }) => [field, String(r.series.find((s) => s.kind === kind)?.start ?? "")])) as Draft;
  const draftOf = (r: (typeof rows)[number]) => drafts[r.id] ?? saved(r);
  const dirty = (r: (typeof rows)[number]) => KINDS.some(({ field }) => draftOf(r)[field] !== saved(r)[field]);

  async function save(r: (typeof rows)[number]) {
    const d = draftOf(r);
    const num = (s: string) => (s.trim() ? Number(s) : null);
    setSaving(r.id);
    try {
      await client.staff.numberSeries.save.mutate({
        locationId: r.id,
        quoteNumberStart: num(d.quoteNumberStart),
        reservationNumberStart: num(d.reservationNumberStart),
        rentalNumberStart: num(d.rentalNumberStart),
      });
      toast.success(`${r.code ?? r.name}: number series saved`);
      setDrafts(({ [r.id]: _, ...rest }) => rest);
      await q.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Location</th>
                {KINDS.map((k) => <th key={k.kind} className="px-3 py-2.5 font-medium">{k.label} — start at</th>)}
                <th className="w-28 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = draftOf(r);
                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.code ?? r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.name}{!r.isActive && " · inactive"}</p>
                    </td>
                    {KINDS.map(({ kind, field, label }) => {
                      const s = r.series.find((x) => x.kind === kind)!;
                      return (
                        <td key={kind} className="px-3 py-3">
                          <Input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            aria-label={`${r.code ?? r.name} ${label} start`}
                            placeholder="Shared"
                            disabled={!isAdmin}
                            className="h-8 w-36 tabular-nums"
                            value={d[field]}
                            onChange={(e) => setDrafts((all) => ({ ...all, [r.id]: { ...d, [field]: e.target.value } }))}
                          />
                          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                            Next number: {s.next}
                            {s.end != null && <> · block ends at {s.end}</>}
                          </p>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <Button type="button" size="sm" disabled={!dirty(r) || saving === r.id} onClick={() => void save(r)}>
                          {saving === r.id && <Loader2Icon className="animate-spin" />}
                          Save
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>“Next number” is the number the next new quote / reservation / agreement at that location will get. The short name is the Location Code from Settings &gt; Locations.</li>
        <li>Every location is listed, including inactive ones and any added later.</li>
        <li>Each location numbers from its start up to the next higher start of any location, so give each one its own block (e.g. 100001, 200001, 300001…).</li>
        <li>Blank (“Shared”) locations use the numbers below the lowest start, as before. Existing quotes, reservations and agreements keep their numbers.</li>
        <li>A start can’t be a number that’s already used in its block, so numbers never mix between locations.</li>
        {!isAdmin && <li>Only admins can change these.</li>}
      </ul>
    </div>
  );
}
