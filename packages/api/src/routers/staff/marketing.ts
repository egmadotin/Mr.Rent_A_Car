import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";
import { router, permitted } from "../../trpc";
import { audit } from "../../lib/audit";
import { sendMail } from "../../lib/mailer";
import { unsubscribeUrl } from "../../lib/unsubscribe";

/** RentCentric's "Select Email" choices on Send Marketing Email (EmailMarketing.aspx), same order. */
const AUDIENCE = ["DIRECT", "BIRTHDAY", "NEW_CUSTOMERS", "LOCATION", "CONFIRMED_RESERVATIONS", "ON_RENT", "CLOSED_RENTALS"] as const;

const audienceInput = z.object({
  audience: z.enum(AUDIENCE).optional(),
  /** Start / End Day and Month (this year; a Birthday range can wrap past December). */
  startDay: z.number().int().min(1).max(31).optional(), startMonth: z.number().int().min(1).max(12).optional(),
  endDay: z.number().int().min(1).max(31).optional(), endMonth: z.number().int().min(1).max(12).optional(),
  locationId: z.string().optional(),
  /** The "Email" box: also send to this address (e.g. a test copy). */
  email: z.string().trim().email().optional().or(z.literal("")),
});
type AudienceInput = z.infer<typeof audienceInput>;

const MAX = 2000;

function period(i: AudienceInput) {
  if (!i.startDay || !i.startMonth || !i.endDay || !i.endMonth) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the Start and End Day / Month." });
  const y = new Date().getFullYear();
  const from = new Date(y, i.startMonth - 1, i.startDay);
  const to = new Date(y, i.endMonth - 1, i.endDay + 1);
  if (to <= from) throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after Start." });
  return { gte: from, lt: to };
}

/** The customers an audience reaches: with an email, active and not unsubscribed from marketing. */
async function recipients(db: Prisma.TransactionClient, i: AudienceInput) {
  if (!i.audience) return [];
  const base: Prisma.CustomerWhereInput = { isActive: true, unsubscribedFromMarketing: false, email: { contains: "@" } };
  const where: Record<(typeof AUDIENCE)[number], () => Prisma.CustomerWhereInput> = {
    DIRECT: () => ({}),
    BIRTHDAY: () => ({ birthDate: { not: null } }),
    NEW_CUSTOMERS: () => ({ createdAt: period(i) }),
    LOCATION: () => {
      if (!i.locationId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the Location." });
      return { OR: [{ enteredLocationId: i.locationId }, { defaultLocationId: i.locationId }] };
    },
    CONFIRMED_RESERVATIONS: () => ({ reservations: { some: { deletedAt: null, status: "CONFIRMED", pickupAt: period(i) } } }),
    ON_RENT: () => ({ rentals: { some: { deletedAt: null, status: "OPEN" } } }),
    CLOSED_RENTALS: () => ({ rentals: { some: { deletedAt: null, status: "CLOSED", checkedInAt: period(i) } } }),
  };
  let cs = await db.customer.findMany({
    where: { ...base, ...where[i.audience]() },
    orderBy: { lastName: "asc" },
    take: 20000,
    select: { id: true, firstName: true, lastName: true, email: true, birthDate: true },
  });
  if (i.audience === "BIRTHDAY") {
    if (!i.startDay || !i.startMonth || !i.endDay || !i.endMonth) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose the Start and End Day / Month." });
    const md = (m: number, d: number) => m * 100 + d;
    const s = md(i.startMonth, i.startDay), e = md(i.endMonth, i.endDay);
    cs = cs.filter((c) => {
      const b = md(c.birthDate!.getUTCMonth() + 1, c.birthDate!.getUTCDate());
      return s <= e ? b >= s && b <= e : b >= s || b <= e;
    });
  }
  // one email per address
  const seen = new Set<string>();
  return cs.filter((c) => {
    const k = c.email!.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const marketingRouter = router({
  /** How many customers the chosen audience reaches (shown before Send). */
  count: permitted("Settings")
    .input(audienceInput)
    .query(async ({ ctx, input }) => {
      const rs = await recipients(ctx.prisma, input);
      return { count: rs.length + (input.email ? 1 : 0), sample: rs.slice(0, 10).map((c) => `${c.firstName} ${c.lastName}`) };
    }),

  /** Send Marketing Email: one email per customer (so each gets their own unsubscribe link), plus the "Email" address. */
  send: permitted("Settings")
    .input(
      audienceInput.extend({
        fromName: z.string().trim().max(100).optional(), fromEmail: z.string().trim().email().optional().or(z.literal("")),
        format: z.enum(["TEXT", "HTML"]), subject: z.string().trim().min(1, "Subject is required").max(200), body: z.string().min(1, "Email body is required").max(200_000),
        allowUnsubscribe: z.boolean().default(true),
        attachment: z.object({ filename: z.string().max(200), contentType: z.string().max(100), base64: z.string().max(7_000_000) }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rs = await recipients(ctx.prisma, input);
      if (!rs.length && !input.email) throw new TRPCError({ code: "BAD_REQUEST", message: "No one to send to — choose who gets the email, or type an Email address." });
      if (rs.length > MAX) throw new TRPCError({ code: "BAD_REQUEST", message: `That reaches ${rs.length} customers; send to at most ${MAX} at a time (narrow the dates or location).` });
      const html = input.format === "HTML" ? input.body : `<pre style="font-family:inherit;white-space:pre-wrap">${esc(input.body)}</pre>`;
      const attachments = input.attachment ? [{ filename: input.attachment.filename, contentType: input.attachment.contentType, content: Buffer.from(input.attachment.base64, "base64") }] : undefined;
      const from = input.fromEmail ? (input.fromName ? `"${input.fromName.replace(/"/g, "")}" <${input.fromEmail}>` : input.fromEmail) : undefined;
      const footer = (id: string) => `<p style="margin-top:24px;font-size:12px;color:#777">Don't want these emails? <a href="${unsubscribeUrl(id)}">Unsubscribe</a></p>`;
      let sent = 0;
      const failed: string[] = [];
      const targets = [...rs.map((c) => ({ to: c.email!, id: c.id as string | null })), ...(input.email ? [{ to: input.email, id: null }] : [])];
      for (const t of targets) {
        try {
          await sendMail(ctx.prisma, {
            to: t.to, subject: input.subject, html: input.allowUnsubscribe && t.id ? html + footer(t.id) : html, from, attachments,
            entityType: t.id ? "Customer" : undefined, entityId: t.id ?? undefined, templateName: "Marketing", sentById: ctx.user.id,
          });
          sent++;
        } catch (e) {
          failed.push(t.to);
          // email not set up: stop at the first one rather than logging a failure per customer
          if (e instanceof TRPCError && e.code === "PRECONDITION_FAILED") throw e;
        }
      }
      await audit(ctx.prisma, "Marketing", "email", ctx.user.id, { Sent: [null, `${input.subject} — ${input.audience ?? "Email only"}: ${sent} sent, ${failed.length} failed`] });
      return { sent, failed };
    }),
});
