import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "@mrac/auth";
import type { Prisma } from "@mrac/db";
import { customerProcedure, publicProcedure, router } from "../trpc";
import { consumeToken, issueToken, siteUrl } from "../lib/customer-account";
import { sendMail } from "../lib/mailer";

type Db = Prisma.TransactionClient;
const DAY = 86_400_000;
const email = z.string().trim().toLowerCase().email("Enter a valid email");
const password = z.string().min(8, "At least 8 characters").max(128);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Link a verified customer account to the customer record with the same email (their RentCentric / earlier bookings),
 * or make one. Done only once the email is verified, so nobody can sign up with someone else's email and see their bookings.
 */
async function linkCustomer(db: Db, userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, emailVerified: true, customer: { select: { id: true } } } });
  if (u.customer || !u.emailVerified) return;
  const existing = await db.customer.findFirst({ where: { email: { equals: u.email, mode: "insensitive" }, userId: null }, orderBy: { updatedAt: "desc" } });
  if (existing) return void (await db.customer.update({ where: { id: existing.id }, data: { userId } }));
  const [firstName, ...rest] = u.name.trim().split(/\s+/);
  await db.customer.create({ data: { firstName: firstName ?? u.name, lastName: rest.join(" ") || "-", email: u.email, userId, registrationChannel: "Website" } });
}

async function sendVerification(db: Db, userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });
  const token = await issueToken(db, "customer-verify", userId, 3 * DAY);
  const link = siteUrl(`/account/verify?token=${token}`);
  await sendMail(db, {
    to: u.email, subject: "Confirm your email — Mr Rent A Car", entityType: "CustomerAccount", entityId: userId,
    html: `<p>Hi ${esc(u.name)},</p><p>Please confirm your email to finish setting up your Mr Rent A Car account:</p><p><a href="${link}">Confirm my email</a></p><p>The link works for 3 days.</p>`,
  });
}

/** Public site "Login": customer accounts (sign up, verify email, forgot / reset password, my details and bookings). */
export const accountRouter = router({
  /** The signed-in customer, or null (a staff session counts as signed out here). */
  me: publicProcedure.query(async ({ ctx }) => {
    const u = ctx.session?.user as { id: string; kind?: string } | undefined;
    if (!u || u.kind !== "CUSTOMER") return null;
    const me = await ctx.prisma.user.findUnique({
      where: { id: u.id },
      select: {
        name: true, email: true, emailVerified: true,
        customer: {
          select: {
            firstName: true, lastName: true, email: true, phone: true, birthDate: true, address1: true, city: true, province: true, country: true, postal: true,
            licenseNumber: true, licenseExpiry: true, licenseProvince: true,
          },
        },
      },
    });
    return me;
  }),

  signUp: publicProcedure
    .input(z.object({ firstName: z.string().trim().min(1, "First name is required").max(80), lastName: z.string().trim().min(1, "Last name is required").max(80), email, password, website: z.string().max(0).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (await ctx.prisma.user.findUnique({ where: { email: input.email } }))
        throw new TRPCError({ code: "CONFLICT", message: "There is already an account with this email. Log in, or use Forgot password." });
      const u = await ctx.prisma.user.create({ data: { name: `${input.firstName} ${input.lastName}`, email: input.email, emailVerified: false, kind: "CUSTOMER", role: "user" } });
      // Better Auth finds an email/password login by accountId = the user's id
      await ctx.prisma.account.create({ data: { userId: u.id, accountId: u.id, providerId: "credential", password: await hashPassword(input.password) } });
      let emailed = true;
      try {
        await sendVerification(ctx.prisma, u.id);
      } catch {
        emailed = false; // email not set up yet: the account works; it links to past bookings once verified
      }
      return { ok: true, emailed };
    }),

  resendVerification: customerProcedure.mutation(async ({ ctx }) => {
    await sendVerification(ctx.prisma, ctx.session.user.id);
    return { ok: true };
  }),

  verifyEmail: publicProcedure.input(z.object({ token: z.string().min(10).max(200) })).mutation(async ({ ctx, input }) => {
    const userId = await consumeToken(ctx.prisma, "customer-verify", input.token);
    if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: "This link has expired or was already used." });
    await ctx.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    await linkCustomer(ctx.prisma, userId);
    return { ok: true };
  }),

  /** Always answers the same, so it can't be used to find out who has an account. */
  requestPasswordReset: publicProcedure.input(z.object({ email })).mutation(async ({ ctx, input }) => {
    const u = await ctx.prisma.user.findUnique({ where: { email: input.email }, select: { id: true, name: true, kind: true, banned: true } });
    if (u && u.kind === "CUSTOMER" && !u.banned) {
      const token = await issueToken(ctx.prisma, "customer-reset", u.id, 60 * 60 * 1000);
      const link = siteUrl(`/account/reset?token=${token}`);
      await sendMail(ctx.prisma, {
        to: input.email, subject: "Reset your password — Mr Rent A Car", entityType: "CustomerAccount", entityId: u.id,
        html: `<p>Hi ${esc(u.name)},</p><p>Use this link to choose a new password:</p><p><a href="${link}">Reset my password</a></p><p>It works for 1 hour. If you didn't ask for this, ignore this email.</p>`,
      }).catch(() => undefined);
    }
    return { ok: true };
  }),

  /** A reset link also proves the email, so the account is verified and linked too. */
  resetPassword: publicProcedure.input(z.object({ token: z.string().min(10).max(200), password })).mutation(async ({ ctx, input }) => {
    const userId = await consumeToken(ctx.prisma, "customer-reset", input.token);
    if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: "This link has expired or was already used. Ask for a new one." });
    const hashed = await hashPassword(input.password);
    const acc = await ctx.prisma.account.updateMany({ where: { userId, providerId: "credential" }, data: { password: hashed } });
    if (!acc.count) await ctx.prisma.account.create({ data: { userId, accountId: userId, providerId: "credential", password: hashed } });
    await ctx.prisma.session.deleteMany({ where: { userId } });
    await ctx.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
    await linkCustomer(ctx.prisma, userId);
    return { ok: true };
  }),

  /** My bookings: the linked customer's reservations and rentals, newest first. */
  bookings: customerProcedure.query(async ({ ctx }) => {
    const c = await ctx.prisma.customer.findUnique({ where: { userId: ctx.session.user.id }, select: { id: true } });
    if (!c) return { reservations: [], rentals: [] };
    const [reservations, rentals] = await Promise.all([
      ctx.prisma.reservation.findMany({
        where: { customerId: c.id, deletedAt: null }, orderBy: { pickupAt: "desc" }, take: 50,
        select: { number: true, status: true, pickupAt: true, returnAt: true, vehicleType: { select: { name: true } }, pickupLocation: { select: { name: true, timeZone: true } }, returnLocation: { select: { name: true } }, chargeLines: { select: { total: true } } },
      }),
      ctx.prisma.rental.findMany({
        where: { customerId: c.id, deletedAt: null, voidedAt: null }, orderBy: { checkOutAt: "desc" }, take: 50,
        select: { raNumber: true, status: true, checkOutAt: true, expectedReturnAt: true, checkedInAt: true, vehicleType: { select: { name: true } }, checkOutLocation: { select: { name: true, timeZone: true } }, checkInLocation: { select: { name: true } } },
      }),
    ]);
    return {
      reservations: reservations.map(({ chargeLines, ...r }) => ({ ...r, total: chargeLines.reduce((a, l) => a + Number(l.total), 0) })),
      rentals,
    };
  }),
});
