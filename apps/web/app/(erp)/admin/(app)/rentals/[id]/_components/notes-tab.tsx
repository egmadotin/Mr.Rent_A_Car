"use client";

import { MessageSquarePlusIcon, PinIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime } from "@mrac/ui/lib/format";
import { CheckField, FormDialog, TextareaField } from "../../../../../_components/form";
import { Empty, Section } from "./section-kit";
import { useRentalActions, type RentalData } from "./use-rental";

function MemoList({ items }: { items: RentalData["rental"]["memos"] }) {
  if (!items.length) return <Empty>Nothing yet.</Empty>;
  return (
    <ul className="divide-y">
      {items.map((m) => (
        <li key={m.id} className="space-y-1 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{m.author?.name ?? "System"}</span>
            <span>{dateTime(m.createdAt)}</span>
            {m.showAsPopup && (
              <Badge variant="warning">
                <PinIcon /> Shown as popup
              </Badge>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Legacy "Memo" + "Memo History" and the separate "Notes" list, side by side. */
export function NotesTab({ data }: { data: RentalData }) {
  const r = data.rental;
  const { api, run } = useRentalActions(r.id);
  const memos = r.memos.filter((m) => m.kind === "MEMO");
  const notes = r.memos.filter((m) => m.kind === "NOTE");

  const add = (kind: "MEMO" | "NOTE") => (
    <FormDialog
      title={kind === "MEMO" ? "Add memo" : "New note"}
      trigger={
        <Button size="sm" variant="outline">
          <MessageSquarePlusIcon /> {kind === "MEMO" ? "Add memo" : "New note"}
        </Button>
      }
      onSubmit={(v) => run(api.addMemo.mutate({ rentalId: r.id, kind, body: v.body as string, showAsPopup: Boolean(v.showAsPopup) }))}
    >
      <TextareaField label={kind === "MEMO" ? "Memo" : "Note"} name="body" required rows={5} />
      {kind === "MEMO" && <CheckField label="Always display as popup when this rental is opened" name="showAsPopup" />}
    </FormDialog>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Memo history" count={memos.length} flush action={add("MEMO")}>
        <MemoList items={memos} />
      </Section>
      <Section title="Notes" count={notes.length} flush action={add("NOTE")}>
        <MemoList items={notes} />
      </Section>
    </div>
  );
}

/** Legacy "Agreements Log": who changed which field, from what, to what. */
export function ActivityTab({ data }: { data: RentalData }) {
  const fmt = (v: string | null) => {
    if (!v) return "—";
    return /^\d{4}-\d{2}-\d{2}T/.test(v) ? dateTime(v) : v;
  };
  return (
    <Section title="Agreement log" count={data.auditLog.length} flush>
      {data.auditLog.length === 0 ? (
        <Empty>No changes recorded.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Old value</TableHead>
              <TableHead>New value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.auditLog.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{dateTime(a.at)}</TableCell>
                <TableCell>{a.user?.name ?? "System"}</TableCell>
                <TableCell className="font-medium">{a.field}</TableCell>
                <TableCell className="text-muted-foreground">{fmt(a.oldValue)}</TableCell>
                <TableCell>{fmt(a.newValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
