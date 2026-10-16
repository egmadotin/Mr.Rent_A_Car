import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { sendMail } from "../../lib/mailer";
import { encryptSecret } from "../../lib/secrets";
import { emailDocument } from "../../lib/email-document";

const optEmail = z.preprocess((v) => (v === "" ? null : v), z.string().trim().email("Enter a valid email").nullable());
const KINDS = ["AGREEMENT", "RESERVATION", "QUOTE"] as const;

/** Settings > Website & Email Setup > Email Setup (admin), and emailing printouts (staff). */
export const emailRouter = router({
  settings: adminProcedure.query(async ({ ctx }) => {
    const s = await ctx.prisma.emailSettings.findUnique({ where: { id: "default" } });
    return {
      isActive: s?.isActive ?? false,
      host: s?.host ?? "",
      port: s?.port ?? 587,
      secure: s?.secure ?? false,
      username: s?.username ?? "",
      password: s?.passwordEnc ? "saved" : null,
      fromName: s?.fromName ?? "Mr Rent A Car",
      fromEmail: s?.fromEmail ?? "",
      bccEmail: s?.bccEmail ?? "",
    };
  }),

  saveSettings: adminProcedure
    .input(
      z.object({
        isActive: z.boolean(),
        host: z.string().trim().max(200),
        port: z.coerce.number().int().min(1).max(65535),
        secure: z.boolean(),
        username: z.string().trim().max(200),
        /** blank = keep the stored password */
        password: z.string().max(500).optional(),
        fromName: z.string().trim().max(120),
        fromEmail: optEmail,
        bccEmail: optEmail,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.isActive && (!input.host || !input.fromEmail)) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the SMTP server and the From email before turning email on." });
      const { password, ...rest } = input;
      const data = { ...rest, host: rest.host || null, username: rest.username || null, updatedById: ctx.user.id, ...(password ? { passwordEnc: encryptSecret(password) } : {}) };
      await ctx.prisma.emailSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
      await audit(ctx.prisma, "EmailSettings", "default", ctx.user.id, { Active: [null, input.isActive], Host: [null, input.host], Password: [null, password ? "changed" : null] });
      return { ok: true };
    }),

  /** "Send test": a short email to the admin's address (or the one given). */
  test: adminProcedure.input(z.object({ to: z.string().trim().email("Enter a valid email") })).mutation(async ({ ctx, input }) => {
    await sendMail(ctx.prisma, { to: input.to, subject: "Mr Rent A Car — test email", html: "<p>This is a test email from the Mr Rent A Car ERP. Email is set up correctly.</p>", sentById: ctx.user.id });
    return { ok: true };
  }),

  /** Email a rental / reservation / quote printed with a template (Email Agreement/Invoice, E-Mail Reservation, Email Quote). */
  sendDocument: staffProcedure
    .input(
      z.object({
        kind: z.enum(KINDS),
        id: z.string(),
        to: z.string().trim().email("Enter a valid email"),
        subject: z.string().trim().min(1, "Subject is required").max(200),
        templateName: z.string().optional(),
        /** text added above the printout */
        message: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => emailDocument(ctx.prisma, { ...input, sentById: ctx.user.id })),

  /** Sent emails for a rental / reservation / quote. */
  log: staffProcedure.input(z.object({ entityType: z.string(), entityId: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.emailLog.findMany({ where: input, orderBy: { createdAt: "desc" }, take: 50 }),
  ),
});
