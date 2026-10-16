import nodemailer from "nodemailer";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";
import { decryptSecret } from "./secrets";

type Db = Prisma.TransactionClient;

/** The SMTP transport from Settings > Email Setup, or null when email isn't set up. */
export async function mailTransport(db: Db) {
  const s = await db.emailSettings.findUnique({ where: { id: "default" } });
  if (!s?.isActive || !s.host || !s.fromEmail) return null;
  const transport = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.username ? { user: s.username, pass: s.passwordEnc ? decryptSecret(s.passwordEnc) : "" } : undefined,
  });
  return { transport, from: s.fromName ? `"${s.fromName.replace(/"/g, "")}" <${s.fromEmail}>` : s.fromEmail, bcc: s.bccEmail || undefined };
}

/**
 * Send one email and record it in EmailLog. Throws a readable error (and logs FAILED) when email isn't set up or the
 * SMTP server refuses it.
 */
export async function sendMail(
  db: Db,
  msg: { to: string; subject: string; html: string; entityType?: string; entityId?: string; templateName?: string | null; sentById?: string | null },
) {
  const log = (status: "SENT" | "FAILED", error?: string) =>
    db.emailLog.create({
      data: { to: msg.to, subject: msg.subject, entityType: msg.entityType, entityId: msg.entityId, templateName: msg.templateName ?? null, status, error, sentById: msg.sentById ?? null },
    });
  const m = await mailTransport(db);
  if (!m) {
    await log("FAILED", "Email is not set up");
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Email isn't set up yet — an admin can add the SMTP account in Settings > Email Setup." });
  }
  try {
    await m.transport.sendMail({ from: m.from, to: msg.to, bcc: m.bcc, subject: msg.subject, html: msg.html });
    await log("SENT");
  } catch (e) {
    await log("FAILED", (e as Error).message);
    throw new TRPCError({ code: "BAD_REQUEST", message: `The email could not be sent: ${(e as Error).message}` });
  }
}
