"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import type { RouterOutputs, Wire } from "@mrac/api";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, fromDateTimeLocal, toDateTimeLocal } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { CheckField, Field, FormDialog, SelectField, TextareaField, errorMessage } from "./form";
import { RowActions } from "./row-actions";

export type TaskRow = Wire<RouterOutputs["staff"]["tasks"]["list"][number]>;

const PRIORITIES = [{ value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }];
const STATUSES = [{ value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Closed" }];

/** Refresh every task list on the page (dashboard panel, My Tasks, Tasks List). */
export function useRefreshTasks() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: trpc.staff.tasks.list.queryKey() });
}

/** Add Task / Edit Task (TasksModify.aspx): Date, Assigned To, Status, Priority, Subject, Task, Email Task. */
function TaskFields({ t, me }: { t?: TaskRow; me?: string }) {
  const trpc = useTRPC();
  const people = useQuery(trpc.staff.tasks.people.queryOptions()).data ?? [];
  const assigned = new Set(t ? t.assigneeIds : me ? [me] : []);
  return (
    <>
      <Field label="Date" name="date" type="datetime-local" required defaultValue={t ? toDateTimeLocal(new Date(t.date)) : toDateTimeLocal(new Date())} />
      <SelectField label="Status" name="status" options={STATUSES} placeholder={false} defaultValue={t?.status ?? "OPEN"} />
      <SelectField label="Priority" name="priority" options={PRIORITIES} placeholder={false} defaultValue={t?.priority ?? "NORMAL"} />
      <Field label="Subject" name="subject" required defaultValue={t?.subject ?? ""} />
      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Assigned To</legend>
        <div className="grid max-h-40 gap-1.5 overflow-auto rounded-md border p-2 sm:grid-cols-2">
          {people.map((p) => <CheckField key={p.id} label={p.name} name="assigneeIds" value={p.id} data-multi="1" defaultChecked={assigned.has(p.id)} />)}
        </div>
      </fieldset>
      <TextareaField label="Task" name="description" rows={4} defaultValue={t?.description ?? ""} />
      <CheckField label="Email Task (send it to the people assigned)" name="emailTask" defaultChecked={t?.emailTask} className="sm:col-span-2" />
    </>
  );
}

function toInput(v: Record<string, unknown>) {
  return {
    date: fromDateTimeLocal(v.date as string),
    subject: v.subject as string,
    description: (v.description as string) ?? null,
    status: (v.status as "OPEN") ?? "OPEN",
    priority: (v.priority as "NORMAL") ?? "NORMAL",
    emailTask: !!v.emailTask,
    assigneeIds: (v.assigneeIds as string[]) ?? [],
  };
}

export function AddTaskButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const me = useQuery({ ...trpc.staff.users.me.queryOptions(), staleTime: 60_000 }).data?.id;
  const refresh = useRefreshTasks();
  return (
    <FormDialog
      title="Add Task"
      wide
      submitLabel="Send"
      trigger={<Button size={size}><PlusIcon /> Add Task</Button>}
      onSubmit={async (v) => {
        const r = await client.staff.tasks.save.mutate({ data: toInput(v) });
        toast.success(v.emailTask ? `Task saved — emailed ${r.emailed} of the people assigned` : "Task saved");
        await refresh();
      }}
    >
      <TaskFields me={me} />
    </FormDialog>
  );
}

/** The task grid (TasksMain.aspx): Subject, Date, Status, Priority, Entered By, Assigned To; close / reopen, edit, delete. */
export function TaskTable({ tasks, compact }: { tasks: TaskRow[]; compact?: boolean }) {
  const client = useTRPCClient();
  const refresh = useRefreshTasks();
  if (!tasks.length) return <p className="rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">No Records Found</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subject</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead>
          {!compact && <><TableHead>Entered By</TableHead><TableHead>Assigned To</TableHead></>}
          <TableHead className="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => {
          const overdue = t.status === "OPEN" && new Date(t.date) < new Date();
          return (
            <TableRow key={t.id} className={cn(t.status === "CLOSED" && "text-muted-foreground")}>
              <TableCell className="font-medium" title={t.description ?? undefined}>{t.subject}</TableCell>
              <TableCell className={cn("whitespace-nowrap", overdue && "text-destructive")}>{dateTime(t.date)}</TableCell>
              <TableCell>{t.status === "OPEN" ? "Open" : "Closed"}</TableCell>
              <TableCell>{t.priority === "HIGH" ? <Badge variant="destructive">High</Badge> : t.priority === "LOW" ? "Low" : "Normal"}</TableCell>
              {!compact && <><TableCell>{t.enteredBy ?? "—"}</TableCell><TableCell>{t.assignedTo.join(", ")}</TableCell></>}
              <TableCell>
                <span className="flex justify-end gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t.status === "OPEN" ? "Close task" : "Reopen task"}
                    title={t.status === "OPEN" ? "Close task" : "Reopen task"}
                    onClick={() => client.staff.tasks.setStatus.mutate({ id: t.id, status: t.status === "OPEN" ? "CLOSED" : "OPEN" }).then(refresh, (e) => toast.error(errorMessage(e)))}
                  >
                    {t.status === "OPEN" ? <CheckIcon /> : <RotateCcwIcon />}
                  </Button>
                  <RowActions
                    label={`task “${t.subject}”`}
                    canEdit
                    canDelete
                    wide
                    editTitle="Edit Task"
                    onSave={async (v) => {
                      await client.staff.tasks.save.mutate({ id: t.id, data: toInput(v) });
                      await refresh();
                    }}
                    onDelete={async () => {
                      await client.staff.tasks.delete.mutate({ id: t.id });
                      await refresh();
                    }}
                  >
                    <TaskFields t={t} />
                  </RowActions>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
