"use client";

import * as React from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { toast } from "@mrac/ui/components/sonner";
import { ConfirmAction } from "./confirm-action";
import { FormDialog, errorMessage } from "./form";
import { NO_PERMISSION } from "./permissions";

/**
 * Edit (pencil → form dialog) and Delete (bin → confirm) buttons for one row of a booking's payments, adjustments,
 * commissions …; each greyed out with the "no permission" hint when the user's group can't do it.
 */
export function RowActions({
  label,
  canEdit,
  canDelete,
  editTitle,
  onSave,
  onDelete,
  wide,
  children,
}: {
  label: string;
  canEdit: boolean;
  canDelete: boolean;
  editTitle: string;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  wide?: boolean;
  /** the edit form's fields, with the row's values as defaults */
  children: React.ReactNode;
}) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <span className="flex justify-end gap-0.5 print:hidden">
      {canEdit ? (
        <FormDialog title={editTitle} wide={wide} trigger={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${label}`}><PencilIcon /></Button>} onSubmit={onSave}>
          {children}
        </FormDialog>
      ) : (
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${label}`} disabled title={NO_PERMISSION}><PencilIcon /></Button>
      )}
      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${label}`} disabled={!canDelete} title={canDelete ? undefined : NO_PERMISSION} onClick={() => setConfirm(true)}>
        <Trash2Icon />
      </Button>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${label}?`}
        description="This changes the booking's balance and can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await onDelete();
            toast.success(`${label} deleted`);
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </span>
  );
}
