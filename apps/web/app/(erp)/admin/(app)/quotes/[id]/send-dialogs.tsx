"use client";

import { useRouter } from "next/navigation";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { SMS_PROVIDERS } from "@mrac/ui/lib/sms-providers";
import { Field, FormDialog, SelectField, TextareaField } from "../../../../_components/form";

type Contact = { quoteId: string; firstName: string; lastName: string; email: string; phone: string; smsText: string };

/** Email Quote (EmailQuoteRW.aspx) / SMS Quote (SMSQuoteRW.aspx) — field for field. */
export function SendQuoteDialogs(c: Contact) {
  const client = useTRPCClient();
  const router = useRouter();
  const done = () => router.refresh();
  return (
    <>
      <FormDialog
        title="Email Quote"
        description="Emails the quote (Settings > Rentals & Invoices, “Quote”) from the mailbox in Settings > Email Setup and saves the contact on the quote."
        wide
        trigger={<Button variant="outline"><MailIcon /> Email Quote</Button>}
        submitLabel="Send Email"
        onSubmit={async (v) => {
          await client.staff.quote.send.mutate({
            quoteId: c.quoteId, channel: "EMAIL",
            firstName: v.firstName as string, lastName: v.lastName as string, email: v.email as string,
            cc: v.cc as string, phone: v.phone as string, notes: v.notes as string,
          });
          done();
        }}
      >
        <Field label="First Name" name="firstName" required defaultValue={c.firstName} />
        <Field label="Last Name" name="lastName" defaultValue={c.lastName} />
        <Field label="Email" name="email" type="email" defaultValue={c.email} />
        <Field label="Cc" name="cc" type="email" />
        <Field label="Phone" name="phone" type="tel" defaultValue={c.phone} />
        <Field label="Attachments" name="attachment" type="file" disabled hint="Up to 3 files — available once file storage is configured." />
        <TextareaField label="Notes" name="notes" rows={4} />
      </FormDialog>
      <FormDialog
        title="SMS Quote"
        description="No SMS provider is configured yet: the request is logged in the memo."
        wide
        trigger={<Button variant="outline"><MessageSquareIcon /> SMS Quote</Button>}
        submitLabel="Send Message"
        onSubmit={async (v) => {
          await client.staff.quote.send.mutate({
            quoteId: c.quoteId, channel: "SMS",
            firstName: v.firstName as string, lastName: v.lastName as string, email: v.email as string,
            phone: v.phone as string, provider: v.provider as string, notes: v.notes as string,
          });
          done();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First Name" name="firstName" required defaultValue={c.firstName} />
          <Field label="Last Name" name="lastName" required defaultValue={c.lastName} />
          <Field label="Email" name="email" type="email" required defaultValue={c.email} />
          <Field label="Cell Phone" name="phone" type="tel" required defaultValue={c.phone} />
          <SelectField label="Provider" name="provider" options={[...SMS_PROVIDERS]} placeholder={false} />
        </div>
        <TextareaField label="Message" name="notes" rows={4} defaultValue={c.smsText} />
      </FormDialog>
    </>
  );
}
