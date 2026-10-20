"use client";

/* eslint-disable @next/next/no-img-element -- uploaded photos are served by /api/files (staff only), not next/image */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { dateTime } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { FormDialog, TextareaField, errorMessage } from "../../../../_components/form";
import { PhotoUploader } from "../../../../_components/inspections";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

type Upload = { key: string; fileName: string; contentType: string; sizeBytes: number };
const parse = (v: unknown): Upload[] => (typeof v === "string" && v ? (JSON.parse(v) as Upload[]) : []);
const url = (key: string) => `/api/files/${key}`;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The vehicle page's Notes, Images (Add More Images) and Documents (Add More Documents), under the action links. */
export function VehicleFilesPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const data = useQuery(trpc.staff.vehicleRecords.files.queryOptions({ vehicleId })).data;
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.files.queryKey({ vehicleId }) });
  const editable = can("VehiclesEdit");
  if (!data) return null;
  const add = (kind: "IMAGE" | "DOCUMENT") => async (v: Record<string, unknown>) => {
    await client.staff.vehicleRecords.fileAdd.mutate({ vehicleId, kind, files: parse(v.images), description: (v.description as string) || null });
    await refresh();
  };
  const del = (id: string, name: string) => (
    <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label={`Delete ${name}`} disabled={!editable} title={editable ? undefined : NO_PERMISSION} onClick={() => setDeleting({ id, name })}>
      <Trash2Icon />
    </Button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle className="font-serif text-lg">Notes</CardTitle>
          <FormDialog
            title="Notes"
            trigger={<Button size="sm" variant="outline" disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PencilIcon /> Edit</Button>}
            onSubmit={async (v) => {
              await client.staff.vehicleRecords.notesSave.mutate({ vehicleId, notes: v.notes as string });
              await refresh();
            }}
          >
            <TextareaField label="Notes" name="notes" rows={6} defaultValue={data.notes ?? ""} />
          </FormDialog>
        </CardHeader>
        <CardContent className="px-4 text-sm whitespace-pre-wrap">{data.notes || <span className="text-muted-foreground">No notes.</span>}</CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle className="font-serif text-lg">Images ({data.images.length})</CardTitle>
          <FormDialog title="Upload Image" trigger={<Button size="sm" variant="outline" disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add More Images</Button>} onSubmit={add("IMAGE")}>
            <PhotoUploader folder="vehicles" label="Select file" />
          </FormDialog>
        </CardHeader>
        <CardContent className="px-4">
          {data.images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {data.images.map((i) => (
                <div key={i.id} className="group relative">
                  <a href={url(i.s3Key)} target="_blank" rel="noreferrer" title={i.fileName} className="block aspect-[4/3] overflow-hidden rounded border bg-muted">
                    <img src={url(i.s3Key)} alt={i.fileName} className="size-full object-cover" loading="lazy" />
                  </a>
                  <div className="absolute top-1 right-1 hidden rounded bg-background/90 group-hover:block">{del(i.id, i.fileName)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle className="font-serif text-lg">Documents ({data.documents.length})</CardTitle>
          <FormDialog title="Upload Document" trigger={<Button size="sm" variant="outline" disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> Add More Documents</Button>} onSubmit={add("DOCUMENT")}>
            <PhotoUploader folder="vehicles" label="Select file" documents />
            <TextareaField label="Description" name="description" rows={2} />
          </FormDialog>
        </CardHeader>
        <CardContent className="px-4">
          {data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.documents.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <a href={url(d.s3Key)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline"><FileTextIcon className="size-4 shrink-0" /><span className="truncate">{d.fileName}</span></a>
                    <span className="block text-xs text-muted-foreground">{[d.description, kb(d.sizeBytes), dateTime(d.uploadedAt)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {del(d.id, d.fileName)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={`Delete ${deleting?.name}?`}
        description="The file is removed."
        confirmLabel="Delete"
        onConfirm={() => client.staff.vehicleRecords.fileDelete.mutate({ id: deleting!.id }).then(refresh, (e) => toast.error(errorMessage(e)))}
      />
    </div>
  );
}
