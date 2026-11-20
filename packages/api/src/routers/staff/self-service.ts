import { z } from "zod";
import type { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";
import { sendMail } from "../../lib/mailer";
import { siteUrl } from "../../lib/customer-account";
import { logoField } from "../../lib/template-fields";
import { SELF_SERVICE_FIELDS, type SelfServiceEmail } from "../../lib/self-service";

type Db = Prisma.TransactionClient;

const blankEmail = (loc: { name: string; email: string | null }): SelfServiceEmail => ({ fromName: loc.name, format: "HTML", fromEmail: loc.email ?? "", replyTo: loc.email ?? "", subject: "", body: "" });
const asEmail = (j: unknown, loc: { name: string; email: string | null }): SelfServiceEmail => ({ ...blankEmail(loc), ...((j as Partial<SelfServiceEmail> | null) ?? {}) });

const optEmail = z.union([z.literal(""), z.string().trim().email("Enter a valid email")]);
const emailInput = z.object({
  fromName: z.string().trim().max(100), format: z.enum(["HTML", "TEXT"]), fromEmail: optEmail, replyTo: optEmail,
  subject: z.string().trim().max(200), body: z.string().max(200_000),
});

const rentalInput = z.object(
  Object.fromEntries(SELF_SERVICE_FIELDS.map((f) => [f.key, f.kind === "bool" ? z.boolean().default(false) : z.number().int().min(0).max(100_000).default(0)])),
);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The location's Self Service Registration Email (when a customer signs up on the website) or Welcome Email (when they
 * confirm their email), with #Keywords# filled. Sent only when that email has a subject and a body; never throws.
 */
export async function sendSelfServiceEmail(db: Db, kind: "registration" | "welcome", userId: string) {
  try {
    const setups = await db.selfServiceSetup.findMany({
      where: { location: { isActive: true } },
      include: { location: true },
      orderBy: { location: { name: "asc" } },
    });
    const pick = setups
      .map((s) => ({ s, e: asEmail(kind === "welcome" ? s.welcomeEmail : s.registrationEmail, s.location) }))
      .sort((a, b) => Number(b.s.location.displayOnline) - Number(a.s.location.displayOnline))
      .find(({ e }) => e.subject.trim() && e.body.trim());
    if (!pick) return false;
    const { s, e } = pick;
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, customer: true } });
    const c = u.customer;
    const [first, ...rest] = u.name.trim().split(/\s+/);
    const loc = s.location;
    const logo = (await logoField(loc.logoKey)).LogoImage;
    const logoSrc = logo.startsWith("/") ? siteUrl(logo) : logo;
    const d = (x: Date | null | undefined) => (x ? x.toLocaleDateString("en-US", { timeZone: "UTC" }) : "");
    const values: Record<string, string> = {
      LocationLogo: e.format === "HTML" ? `<img src="${logoSrc.replace(/"/g, "&quot;")}" alt="Mr Rent A Car" style="max-width:180px" />` : "",
      LocationName: loc.name, Address: loc.address1 ?? "", City: loc.city ?? "", website: "http://www.mrrentacar.com", State: loc.province ?? "", Zip: loc.postal ?? "",
      Country: loc.country === "CA" ? "Canada" : (loc.country ?? ""), TollFree: loc.tollFree ?? "", Phone: loc.phone ?? "", fax: loc.fax ?? "", Email: loc.email ?? "",
      FirstName: c?.firstName ?? first ?? "", LastName: c?.lastName ?? rest.join(" "), CustomerEmail: c?.email ?? u.email, CustomerPhone: c?.phone ?? "",
      CustomerAddress: c?.address1 ?? "", CustomerCity: c?.city ?? "", CustomerCountry: c?.country ?? "", CustomerStateCode: c?.province ?? "", CustomerZip: c?.postal ?? "",
      CustomerLicenseNumber: c?.licenseNumber ?? "", CustomerLicenseExpiry: d(c?.licenseExpiry), CustomerBirthday: d(c?.birthDate),
    };
    const fill = (t: string, html: boolean) =>
      t.replace(/#(\w+)#/g, (m, k: string) => (k in values ? (html && k !== "LocationLogo" ? esc(values[k]!) : values[k]!) : m));
    const html = e.format === "HTML" ? fill(e.body, true) : esc(fill(e.body, false)).replace(/\n/g, "<br />");
    await sendMail(db, {
      to: u.email, subject: fill(e.subject, false), html, entityType: "CustomerAccount", entityId: userId,
      templateName: kind === "welcome" ? "Self Service Welcome Email" : "Self Service Registration Email",
      from: e.fromEmail ? (e.fromName ? `"${e.fromName.replace(/"/g, "")}" <${e.fromEmail}>` : e.fromEmail) : undefined,
      ...(e.replyTo ? { replyTo: e.replyTo } : {}),
    });
    return true;
  } catch {
    return false; // email not set up / refused: the sign-up itself still works (and the failure is in the email log)
  }
}

/** Settings > Self Service & Car Share SetUp: Rental Setup, Welcome Email, Registration Email, Welcome SMS — per location. */
export const selfServiceRouter = router({
  get: staffProcedure.input(z.object({ locationId: z.string().min(1) })).query(async ({ ctx, input }) => {
    const loc = await ctx.prisma.location.findUniqueOrThrow({ where: { id: input.locationId }, select: { name: true, email: true } });
    const s = await ctx.prisma.selfServiceSetup.findUnique({ where: { locationId: input.locationId } });
    const saved = (s?.rental ?? {}) as Record<string, unknown>;
    const rental = Object.fromEntries(SELF_SERVICE_FIELDS.map((f) => [f.key, f.kind === "bool" ? saved[f.key] === true : Number(saved[f.key] ?? 0) || 0])) as Record<string, boolean | number>;
    return {
      rental,
      welcomeEmail: asEmail(s?.welcomeEmail, loc),
      registrationEmail: asEmail(s?.registrationEmail, loc),
      welcomeSms: s?.welcomeSms ?? "",
      urls: { reservation: siteUrl("/book"), registration: siteUrl("/account/signup"), login: siteUrl("/account/login") },
    };
  }),

  saveRental: permitted("Settings")
    .input(z.object({ locationId: z.string().min(1), rental: rentalInput }))
    .mutation(async ({ ctx, input }) => {
      const data = { rental: input.rental as Prisma.InputJsonObject, updatedById: ctx.user.id };
      await ctx.prisma.selfServiceSetup.upsert({ where: { locationId: input.locationId }, create: { locationId: input.locationId, ...data }, update: data });
      await audit(ctx.prisma, "SelfServiceSetup", input.locationId, ctx.user.id, { "Rental Setup": [null, "saved"] });
    }),

  saveEmail: permitted("AgreementFormsEdit")
    .input(z.object({ locationId: z.string().min(1), kind: z.enum(["welcome", "registration"]), email: emailInput }))
    .mutation(async ({ ctx, input }) => {
      const field = input.kind === "welcome" ? "welcomeEmail" : "registrationEmail";
      const data = { [field]: input.email as Prisma.InputJsonObject, updatedById: ctx.user.id };
      await ctx.prisma.selfServiceSetup.upsert({ where: { locationId: input.locationId }, create: { locationId: input.locationId, ...data }, update: data });
      await audit(ctx.prisma, "SelfServiceSetup", input.locationId, ctx.user.id, { [input.kind === "welcome" ? "Welcome Email" : "Registration Email"]: [null, "saved"] });
    }),

  saveSms: permitted("AgreementFormsEdit")
    .input(z.object({ locationId: z.string().min(1), body: z.string().max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const data = { welcomeSms: input.body, updatedById: ctx.user.id };
      await ctx.prisma.selfServiceSetup.upsert({ where: { locationId: input.locationId }, create: { locationId: input.locationId, ...data }, update: data });
      await audit(ctx.prisma, "SelfServiceSetup", input.locationId, ctx.user.id, { "Welcome SMS": [null, "saved"] });
    }),
});
