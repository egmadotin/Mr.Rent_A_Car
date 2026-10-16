"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, SendIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { errorMessage } from "./form";

/**
 * Email a rental / reservation / quote printed with one of its location's templates (Email Agreement/Invoice,
 * E-Mail Reservation Details, Email Reservation Form/Invoice, Email Quote).
 */
export function EmailDocumentDialog({
  open,
  onOpenChange,
  kind,
  id,
  locationId,
  defaultTo,
  defaultSubject,
  title,
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: "AGREEMENT" | "RESERVATION" | "QUOTE";
  id: string;
  locationId: string;
  defaultTo?: string | null;
  defaultSubject: string;
  title: string;
  onSent?: () => void;
}) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const templates = useQuery({ ...trpc.staff.template.list.queryOptions({ kind, locationId, activeOnly: true }), enabled: open }).data;
  const [to, setTo] = React.useState(defaultTo ?? "");
  const [subject, setSubject] = React.useState(defaultSubject);
  const [template, setTemplate] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTo(defaultTo ?? "");
      setSubject(defaultSubject);
      setMessage("");
    }
  }, [open, defaultTo, defaultSubject]);
  React.useEffect(() => {
    if (templates?.length && !templates.some((t) => t.name === template)) setTemplate((templates.find((t) => t.isDefault) ?? templates[0])!.name);
  }, [templates, template]);

  async function send() {
    setSending(true);
    try {
      const r = await client.staff.email.sendDocument.mutate({ kind, id, to, subject, templateName: template || undefined, message: message || undefined });
      toast.success(`Emailed “${r.template}” to ${to}`);
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Sent from the mailbox in Settings &gt; Email Setup, with the printout chosen below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="em-to">To</Label><Input id="em-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="em-subject">Subject</Label><Input id="em-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="em-template">Printout</Label>
            <NativeSelect id="em-template" value={template} onChange={(e) => setTemplate(e.target.value)}>
              {!templates?.length && <option value="">{templates ? "No templates set up" : "Loading…"}</option>}
              {templates?.map((t) => <option key={t.id}>{t.name}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5"><Label htmlFor="em-message">Message (optional)</Label><Textarea id="em-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending || !to || !template}>{sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
