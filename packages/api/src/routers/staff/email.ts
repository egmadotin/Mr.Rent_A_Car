import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, permitted, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { sendMail } from "../../lib/mailer";
import { encryptSecret } from "../../lib/secrets";
import { emailDocument } from "../../lib/email-document";
import { SMS_GATEWAYS, sendSms, smsGateway } from "../../lib/sms";
import { DASHBOARD_KEYWORDS, NEW_RES_KEYWORDS } from "../../lib/sms-notify";

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
  /** Settings > Reservation Email (WebCustomerEmailSetup.aspx) for one location. */
  reservationEmailGet: staffProcedure.input(z.object({ locationId: z.string() })).query(async ({ ctx, input }) => {
    const s = await ctx.prisma.reservationEmailSetup.findUnique({ where: { locationId: input.locationId } });
    return {
      fromName: s?.fromName ?? "", fromEmail: s?.fromEmail ?? "", format: (s?.format ?? "HTML") as "HTML" | "TEXT", copyTo: s?.copyTo ?? "",
      subject: s?.subject ?? "Reservation Confirmation", body: s?.body ?? "", identityVerificationUrl: s?.identityVerificationUrl ?? "",
    };
  }),

  /** "Use For All Locations" saves the same setup on every location. The body is HTML sent as-is, so the templates permission. */
  reservationEmailSave: permitted("AgreementFormsEdit")
    .input(
      z.object({
        locationId: z.string(), allLocations: z.boolean().default(false),
        data: z.object({
          fromName: z.string().trim().max(100).nullable(), fromEmail: optEmail, format: z.enum(["HTML", "TEXT"]), copyTo: optEmail,
          subject: z.string().trim().min(1, "Subject is required").max(200), body: z.string().max(200_000), identityVerificationUrl: z.string().trim().max(500).nullable(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ids = input.allLocations ? (await ctx.prisma.location.findMany({ select: { id: true } })).map((l) => l.id) : [input.locationId];
      for (const locationId of ids) await ctx.prisma.reservationEmailSetup.upsert({ where: { locationId }, create: { locationId, ...input.data }, update: input.data });
      return { saved: ids.length };
    }),

  /** Settings > Quote Email (QuoteCustomerEmail.aspx). */
  quoteEmailGet: staffProcedure.query(async ({ ctx }) => {
    const s = await ctx.prisma.emailSettings.findUnique({ where: { id: "default" }, select: { quoteSubject: true, quoteBody: true } });
    return { subject: s?.quoteSubject ?? "Quote", body: s?.quoteBody ?? "" };
  }),

  quoteEmailSave: permitted("AgreementFormsEdit")
    .input(z.object({ subject: z.string().trim().min(1, "Subject is required").max(200), body: z.string().max(200_000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.emailSettings.upsert({ where: { id: "default" }, create: { id: "default", quoteSubject: input.subject, quoteBody: input.body }, update: { quoteSubject: input.subject, quoteBody: input.body } });
    }),

  /** Settings > SMS Notifications Setup (SMSNotificationMain.aspx) and SMS Notification Users. */
  smsSettings: staffProcedure.query(async ({ ctx }) => {
    const s = await ctx.prisma.emailSettings.findUnique({ where: { id: "default" }, select: { smsNewResEnabled: true, smsNewResMessage: true, smsDashboardEnabled: true, smsDashboardMessage: true, smsDashboardTimes: true } });
    const users = await ctx.prisma.smsNotificationUser.findMany({ orderBy: { name: "asc" }, include: { location: { select: { name: true } } } });
    return {
      newResEnabled: s?.smsNewResEnabled ?? false, newResMessage: s?.smsNewResMessage ?? "", dashboardEnabled: s?.smsDashboardEnabled ?? false,
      dashboardMessage: s?.smsDashboardMessage ?? "", dashboardTimes: s?.smsDashboardTimes ?? [], users,
      providers: SMS_GATEWAYS.map(([name, gateway]) => ({ name, gateway })), newResKeywords: NEW_RES_KEYWORDS, dashboardKeywords: DASHBOARD_KEYWORDS,
    };
  }),

  smsSettingsSave: permitted("Settings")
    .input(
      z.object({
        newResEnabled: z.boolean(), newResMessage: z.string().max(1000), dashboardEnabled: z.boolean(), dashboardMessage: z.string().max(1000),
        dashboardTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/, "Times as HH:MM")).max(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = { smsNewResEnabled: input.newResEnabled, smsNewResMessage: input.newResMessage, smsDashboardEnabled: input.dashboardEnabled, smsDashboardMessage: input.dashboardMessage, smsDashboardTimes: [...new Set(input.dashboardTimes)].sort() };
      await ctx.prisma.emailSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    }),

  smsUserSave: permitted("Settings")
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Username is required").max(100),
        phone: z.string().trim().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 15, "Mobile Phone: numbers only, 10 digits or more"),
        provider: z.string().refine((v) => !!smsGateway(v), "Choose a provider"),
        email: optEmail.optional(),
        locationId: z.string().optional().nullable().transform((v) => v || null),
        newReservation: z.boolean(), realtimeDashboard: z.boolean(), isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const u = id ? await ctx.prisma.smsNotificationUser.update({ where: { id }, data }) : await ctx.prisma.smsNotificationUser.create({ data });
      return { id: u.id };
    }),

  smsUserDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.smsNotificationUser.delete({ where: { id: input.id } });
  }),

  /** SMSNotificationModify.aspx "Send SMS": a test text to the number. */
  smsTest: permitted("Settings").input(z.object({ phone: z.string(), provider: z.string() })).mutation(async ({ ctx, input }) => {
    try {
      await sendSms(ctx.prisma, { phone: input.phone, provider: input.provider, text: "Test message from Mr Rent A Car.", entityType: "SmsTest", sentById: ctx.user.id });
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
    }
  }),

  log: staffProcedure.input(z.object({ entityType: z.string(), entityId: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.emailLog.findMany({ where: input, orderBy: { createdAt: "desc" }, take: 50 }),
  ),
});
