"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@mrac/ui/components/alert-dialog";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "./form";

/**
 * Confirmation for state-changing / destructive actions. Fixes the legacy pattern of
 * Void / Delete / ReOpen links firing with no confirmation, styled like Print.
 *
 * - `requireText`: the user must type this exactly (e.g. the RA number) to enable the action.
 * - `reasonLabel`: collect a free-text reason, passed to onConfirm.
 */
export function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  requireText,
  reasonLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  requireText?: string;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setReason("");
    }
  }, [open]);

  const blocked = (requireText !== undefined && typed.trim() !== requireText) || (reasonLabel !== undefined && reason.trim().length < 3);

  async function run() {
    setPending(true);
    try {
      await onConfirm(reason.trim());
      toast.success(`${title} — done`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reasonLabel && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Input id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
        )}
        {requireText !== undefined && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-text">
              Type <span className="font-mono font-semibold">{requireText}</span> to confirm
            </Label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus={!reasonLabel} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} disabled={blocked || pending} onClick={run}>
            {pending && <Loader2Icon className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
