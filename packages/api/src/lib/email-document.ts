import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";
import { sendMail } from "./mailer";
import { quoteTemplateFields, renderTemplate, rentalTemplateFields, reservationTemplateFields } from "./template-fields";

type Db = Prisma.TransactionClient;

/**
 * Email a rental (AGREEMENT), reservation or quote printed with a template (the named one, else the location's default,
 * else its first active one), log it, and note it on the record.
 */
export async function emailDocument(
  db: Db,
  input: { kind: "AGREEMENT" | "RESERVATION" | "QUOTE"; id: string; to: string; subject: string; templateName?: string; message?: string; sentById?: string | null; from?: string; bcc?: string },
) {
  const where =
    input.kind === "AGREEMENT"
      ? await db.rental.findUnique({ where: { id: input.id }, select: { checkOutLocationId: true } }).then((r) => r?.checkOutLocationId)
      : input.kind === "RESERVATION"
        ? await db.reservation.findUnique({ where: { id: input.id }, select: { pickupLocationId: true } }).then((r) => r?.pickupLocationId)
        : await db.quote.findUnique({ where: { id: input.id }, select: { pickupLocationId: true } }).then((r) => r?.pickupLocationId);
  if (!where) throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
  const t = await db.documentTemplate.findFirst({
    where: { kind: input.kind, isActive: true, OR: [{ locationId: where }, { locationId: null }], ...(input.templateName ? { name: input.templateName } : { isDefault: true }) },
    orderBy: { locationId: "desc" },
  }) ?? (input.templateName ? null : await db.documentTemplate.findFirst({ where: { kind: input.kind, isActive: true, locationId: where }, orderBy: { name: "asc" } }));
  if (!t) throw new TRPCError({ code: "BAD_REQUEST", message: "No template to email — set one up in Settings > Rentals & Invoices." });
  const fields =
    input.kind === "AGREEMENT"
      ? await rentalTemplateFields(db, input.id)
      : input.kind === "RESERVATION"
        ? await reservationTemplateFields(db, input.id)
        : await quoteTemplateFields(db, input.id);
  const body = renderTemplate(t.html, fields, input.kind);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
  await sendMail(db, {
    to: input.to,
    subject: input.subject,
    html: `${input.message ? `<p>${esc(input.message)}</p><hr />` : ""}${body}`,
    entityType: input.kind === "AGREEMENT" ? "RENTAL" : input.kind,
    entityId: input.id,
    templateName: t.name,
    sentById: input.sentById ?? null,
    from: input.from,
    bcc: input.bcc,
  });
  const memo = `Emailed "${t.name}" to ${input.to}`;
  if (input.kind === "AGREEMENT") await db.memo.create({ data: { rentalId: input.id, kind: "NOTE", body: memo, authorId: input.sentById ?? null } });
  if (input.kind === "RESERVATION") {
    await db.memo.create({ data: { reservationId: input.id, kind: "NOTE", body: memo, authorId: input.sentById ?? null } });
    await db.reservation.update({ where: { id: input.id }, data: { confirmationEmailSentAt: new Date() } });
  }
  return { ok: true, template: t.name };
}
