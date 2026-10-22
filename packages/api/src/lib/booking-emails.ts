import type { Prisma } from "@mrac/db";
import { emailDocument } from "./email-document";
import { sendMail } from "./mailer";
import { HTML_FIELDS, QUOTE_EMAIL_HTML, quoteEmailFields, renderCodes, renderTemplate, reservationTemplateFields } from "./template-fields";

type Db = Prisma.TransactionClient;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fromOf = (name?: string | null, email?: string | null) => (email ? (name && name !== email ? `"${name.replace(/"/g, "")}" <${email}>` : email) : undefined);

/**
 * The reservation email (Settings > Reservation Email, by the pickup location): its From, Subject and a copy to staff;
 * its own body when one is set (Text or HTML, the reservation's ##codes## filled), else the Reservation Confirmation template.
 */
export async function sendReservationEmail(db: Db, reservationId: string, to: string, sentById: string | null) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId }, select: { pickupLocationId: true } });
  const s = await db.reservationEmailSetup.findUnique({ where: { locationId: r.pickupLocationId } });
  const subject = s?.subject || "Reservation Confirmation";
  const from = fromOf(s?.fromName, s?.fromEmail);
  const bcc = s?.copyTo || undefined;
  if (!s?.body.trim()) return emailDocument(db, { kind: "RESERVATION", id: reservationId, to, subject, sentById, from, bcc });
  const filled = renderTemplate(s.body, await reservationTemplateFields(db, reservationId), "RESERVATION", HTML_FIELDS);
  const html = s.format === "TEXT" ? `<pre style="font-family:inherit;white-space:pre-wrap">${esc(filled)}</pre>` : filled;
  await sendMail(db, { to, subject, html, from, bcc, entityType: "RESERVATION", entityId: reservationId, templateName: "Reservation Email", sentById });
  await db.memo.create({ data: { reservationId, kind: "NOTE", body: `Emailed the reservation email to ${to}`, authorId: sentById } });
  await db.reservation.update({ where: { id: reservationId }, data: { confirmationEmailSentAt: new Date() } });
  return { ok: true, template: "Reservation Email" };
}

/** Email Quote: Settings > Quote Email's Subject and body when a body is set, else the Quote template. */
export async function sendQuoteEmail(db: Db, quoteId: string, to: string, message: string | undefined, sentById: string) {
  const s = await db.emailSettings.findUnique({ where: { id: "default" }, select: { quoteSubject: true, quoteBody: true } });
  const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { number: true } });
  if (!s?.quoteBody.trim()) return emailDocument(db, { kind: "QUOTE", id: quoteId, to, subject: `Your quote #${q.number} — Mr Rent A Car`, message, sentById });
  const body = renderCodes(s.quoteBody, await quoteEmailFields(db, quoteId), QUOTE_EMAIL_HTML);
  const html = `${message ? `<p>${esc(message).replace(/\n/g, "<br />")}</p><hr />` : ""}${body}`;
  await sendMail(db, { to, subject: s.quoteSubject || "Quote", html, entityType: "QUOTE", entityId: quoteId, templateName: "Quote Email", sentById });
  return { ok: true, template: "Quote Email" };
}
