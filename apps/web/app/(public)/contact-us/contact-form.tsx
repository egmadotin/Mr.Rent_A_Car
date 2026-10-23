"use client";

import { InfoIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { Textarea } from "@mrac/ui/components/textarea";

/**
 * Same fields as the current Contact form (Name, Email, Phone, Subject, Message, privacy consent).
 * Submission is not wired yet: where messages go (email inbox vs. ERP) is an open client question.
 */
export function ContactForm() {
  return (
    <form className="space-y-5 rounded-card border bg-card p-5 sm:p-8" onSubmit={(e) => e.preventDefault()} aria-describedby="contact-status">
      <h2 className="type-title-3">Send us a message</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" autoComplete="name" required /></div>
        <div className="space-y-1.5"><Label htmlFor="c-email">Email</Label><Input id="c-email" name="email" type="email" autoComplete="email" required /></div>
        <div className="space-y-1.5"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" name="phone" type="tel" autoComplete="tel" /></div>
        <div className="space-y-1.5"><Label htmlFor="c-subject">Subject</Label><Input id="c-subject" name="subject" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-message">Message</Label><Textarea id="c-message" name="message" rows={5} required /></div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required className="mt-0.5 size-4 accent-[var(--ink)]" />
        I agree to the privacy policy and terms.
      </label>
      <p id="contact-status" className="flex items-center gap-2.5 rounded-control bg-steel-tint px-4 py-3 text-sm text-foreground">
        <InfoIcon className="size-4 shrink-0 text-steel" /> Online messages are switched on once the email destination is confirmed. Meanwhile, call or email us.
      </p>
      <Button type="submit" size="lg" disabled>Send message</Button>
    </form>
  );
}
