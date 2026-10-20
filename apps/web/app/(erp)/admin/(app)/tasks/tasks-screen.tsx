"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { AddTaskButton, TaskTable } from "../../../_components/tasks";

const day = (d: Date) => d.toISOString().slice(0, 10);
type Filters = { from: string; to: string; enteredBy: string; assignedTo: string; status: string; priority: string; subject: string };

/** My Tasks (TasksMain.aspx) and the Tasks List report (TasksList.aspx: Date Entered From / To, Entered By, Assigned To, Status, Priority, Subject). */
export function TasksScreen() {
  const trpc = useTRPC();
  const mine = useQuery(trpc.staff.tasks.list.queryOptions({ mine: true })).data ?? [];
  const people = useQuery(trpc.staff.tasks.people.queryOptions()).data ?? [];
  const [f, setF] = React.useState<Filters>({ from: day(new Date(Date.now() - 30 * 86_400_000)), to: day(new Date()), enteredBy: "", assignedTo: "", status: "ALL", priority: "ALL", subject: "" });
  const [run, setRun] = React.useState<Filters | null>(null);
  const list = useQuery({
    ...trpc.staff.tasks.list.queryOptions({
      from: run ? new Date(`${run.from}T00:00`) : undefined,
      to: run ? new Date(+new Date(`${run.to}T00:00`) + 86_400_000) : undefined,
      enteredByIds: run?.enteredBy ? [run.enteredBy] : undefined,
      assignedToIds: run?.assignedTo ? [run.assignedTo] : undefined,
      status: (run?.status ?? "ALL") as "ALL",
      priority: (run?.priority ?? "ALL") as "ALL",
      subject: run?.subject || undefined,
    }),
    enabled: !!run,
  });
  const sel = (k: keyof Filters, label: string, options: { value: string; label: string }[]) => (
    <div className="space-y-1">
      <Label htmlFor={`t-${k}`}>{label}</Label>
      <NativeSelect id={`t-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
  const everyone = [{ value: "", label: "All" }, ...people.map((p) => ({ value: p.id, label: p.name }))];

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="mine">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="mine">My Tasks ({mine.filter((t) => t.status === "OPEN").length} open)</TabsTrigger>
            <TabsTrigger value="list">Tasks List</TabsTrigger>
          </TabsList>
          <AddTaskButton size="default" />
        </div>
        <TabsContent value="mine" className="mt-4">
          <Card className="py-0"><CardContent className="px-0"><TaskTable tasks={mine} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="list" className="mt-4 space-y-4">
          <Card className="py-4">
            <CardContent className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1"><Label htmlFor="t-from">Date Entered From</Label><Input id="t-from" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="t-to">To</Label><Input id="t-to" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
              {sel("enteredBy", "Entered By", everyone)}
              {sel("assignedTo", "Assigned To", everyone)}
              {sel("status", "Status", [{ value: "ALL", label: "All" }, { value: "OPEN", label: "Open" }, { value: "CLOSED", label: "Closed" }])}
              {sel("priority", "Priority", [{ value: "ALL", label: "All" }, { value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }])}
              <div className="space-y-1"><Label htmlFor="t-subject">Subject</Label><Input id="t-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
              <div className="flex items-end"><Button onClick={() => setRun({ ...f })}><SearchIcon /> Generate</Button></div>
            </CardContent>
          </Card>
          {run && (
            <Card className="py-0">
              <CardContent className="px-0">{list.isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> : <TaskTable tasks={list.data ?? []} />}</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
