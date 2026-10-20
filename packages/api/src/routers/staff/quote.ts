import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { emailDocument } from "../../lib/email-document";
import { audit } from "../../lib/audit";
import { priceBooking } from "../../lib/pricing";
import { bookingOptionsInput, staffPricingOptions } from "../../lib/booking-options";
import { storedRateOverride } from "../../lib/rate-override";

const D = (n: number) => new Prisma.Decimal(n);
const optStr = z.string().trim().max(500).optional().nullable().transform((v) => v || null);
const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nonnegative().nullable());
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

/** Add Quote (QuotesModify.aspx): trip, type, Rate (required), discount, referral, options grid; + contact. */
const quoteInput = z
  .object({
    pickupAt: z.coerce.date({ invalid_type_error: "Pickup date is required" }),
    returnAt: z.coerce.date({ invalid_type_error: "Return date is required" }),
    pickupLocationId: req("Pickup location"),
    returnLocationId: req("Return location"),
    companyId: optStr,
    vehicleTypeId: req("Vehicle type"),
    rateId: req("Rate"),
    discountType: z.preprocess((v) => (v === "" ? null : v), z.enum(["PERCENT", "AMOUNT"]).nullable().optional()),
    discountValue: optNum,
    referralId: optStr,
    customerId: optStr,
    firstName: optStr,
    lastName: optStr,
    email: z.preprocess((v) => (v === "" ? null : v), z.string().trim().email("Invalid email").nullable().optional()),
    contactPhone: optStr,
    options: bookingOptionsInput.default({}),
  })
  .superRefine((v, ctx) => {
    if (v.returnAt <= v.pickupAt) ctx.addIssue({ code: "custom", path: ["returnAt"], message: "Return must be after pickup" });
  });

async function writeQuote(tx: Prisma.TransactionClient, userId: string, input: z.infer<typeof quoteInput>, quoteId?: string) {
  let { firstName, lastName, email, contactPhone } = input;
  if (input.customerId) {
    const c = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    firstName ??= c.firstName;
    lastName ??= c.lastName;
    email ??= c.email;
    contactPhone ??= c.phone;
  }
  const contactName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const priced = await priceBooking(tx, {
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    locationId: input.pickupLocationId,
    returnLocationId: input.returnLocationId,
    vehicleTypeId: input.vehicleTypeId,
    rateId: input.rateId,
    discountType: input.discountType,
    discountValue: input.discountValue,
    ...staffPricingOptions(input.options),
  });
  const data = {
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    pickupLocationId: input.pickupLocationId,
    returnLocationId: input.returnLocationId,
    companyId: input.companyId,
    vehicleTypeId: input.vehicleTypeId,
    rateId: input.rateId,
    rateOverride: storedRateOverride(input.options.rateOverride),
    discountType: input.discountType ?? null,
    discountValue: input.discountValue == null ? null : D(input.discountValue),
    referralId: input.referralId,
    customerId: input.customerId,
    contactName,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    email: email ?? null,
    contactPhone,
    excludedTaxIds: input.options.excludedTaxIds,
  };
  let id = quoteId;
  if (id) {
    await tx.quote.update({ where: { id }, data });
    await tx.chargeLine.deleteMany({ where: { quoteId: id } });
    await audit(tx, "Quote", id, userId, { Updated: [null, "yes"] });
  } else {
    const q = await tx.quote.create({ data: { ...data, createdById: userId } });
    id = q.id;
    await audit(tx, "Quote", id, userId, { QuoteNumber: [null, q.number] });
  }
  await tx.chargeLine.createMany({ data: priced.lines.map((l) => ({ ...l, quoteId: id! })) });
  return id;
}

export const quoteRouter = router({
  /** QuotesSearch.aspx: quick search (Quote # OR First Name OR Last Name) + Advanced Search. */
  list: permitted("CheckViewQuote")
    .input(
      z.object({
        search: z.string().optional(),
        number: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        locationId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.search?.trim();
      const n = q && /^\d+$/.test(q) ? Number(q) : undefined;
      const name = (field: "firstName" | "lastName", v?: string) =>
        v?.trim() ? [{ OR: [{ [field]: { contains: v.trim(), mode: "insensitive" } }, { customer: { [field]: { contains: v.trim(), mode: "insensitive" } } }] }] : [];
      const where: Prisma.QuoteWhereInput = {
        deletedAt: null,
        pickupLocationId: input.locationId,
        createdAt: { gte: input.from, lte: input.to },
        AND: [
          ...(q
            ? [{
                OR: [
                  ...(n ? [{ number: n }] : []),
                  { firstName: { contains: q, mode: "insensitive" as const } },
                  { lastName: { contains: q, mode: "insensitive" as const } },
                  { contactName: { contains: q, mode: "insensitive" as const } },
                  { customer: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } },
                ],
              }]
            : []),
          ...(input.number?.trim() && /^\d+$/.test(input.number.trim()) ? [{ number: Number(input.number.trim()) }] : []),
          ...name("firstName", input.firstName),
          ...name("lastName", input.lastName),
          ...(input.phone?.trim() ? [{ OR: [{ contactPhone: { contains: input.phone.trim() } }, { customer: { phone: { contains: input.phone.trim() } } }] }] : []),
        ] as Prisma.QuoteWhereInput[],
      };
      const [total, rows] = await Promise.all([
        ctx.prisma.quote.count({ where }),
        ctx.prisma.quote.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true, number: true, createdAt: true, contactName: true, contactPhone: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
            pickupLocation: { select: { name: true, quoteExpiresAfter: true } },
          },
        }),
      ]);
      const now = Date.now();
      return {
        total,
        rows: rows.map((r) => ({
          id: r.id,
          number: r.number,
          createdAt: r.createdAt,
          fullName: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : r.contactName,
          phone: r.contactPhone ?? r.customer?.phone ?? null,
          locationName: r.pickupLocation.name,
          // "Expired" after the location's Quote Expires After days (0 = never)
          expired: r.pickupLocation.quoteExpiresAfter > 0 && +r.createdAt + r.pickupLocation.quoteExpiresAfter * 86_400_000 < now,
        })),
      };
    }),

  byId: permitted("CheckViewQuote").input(z.object({ quoteId: z.string() })).query(async ({ ctx, input }) => {
    const q = await ctx.prisma.quote.findFirst({
      where: { id: input.quoteId, deletedAt: null },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        company: { select: { id: true, name: true } },
        returnLocation: { select: { id: true, name: true } },
        vehicleType: { select: { id: true, name: true, description: true, seats: true, doors: true, luggage: true, imageKey: true, transmission: true } },
        rate: { select: { id: true, code: true, graceMinutes: true, fuelChargePerUnit: true, values: true } },
        pickupLocation: { select: { id: true, name: true, address1: true, city: true, province: true, postal: true, country: true, phone: true, fax: true, email: true, timeZone: true } },
        referral: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        chargeLines: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { tax: { select: { kind: true } }, miscCharge: { select: { calculationBy: true } }, insurance: { select: { calculationBy: true } } },
        },
        memos: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        reservations: { where: { deletedAt: null }, select: { id: true, number: true, status: true } },
      },
    });
    if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Quote not found" });
    return { quote: q, total: q.chargeLines.reduce((a, l) => a.add(l.total), D(0)) };
  }),

  create: permitted("CheckAddQuote").input(quoteInput).mutation(async ({ ctx, input }) => ({
    id: await ctx.prisma.$transaction((tx) => writeQuote(tx, ctx.user.id, input)),
  })),

  update: permitted("CheckEditkOuote").input(z.object({ quoteId: z.string(), data: quoteInput })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.quote.findFirstOrThrow({ where: { id: input.quoteId, deletedAt: null } });
    return { id: await ctx.prisma.$transaction((tx) => writeQuote(tx, ctx.user.id, input.data, input.quoteId)) };
  }),

  /** Legacy grid had an inline delete (x) with no confirmation; the UI now confirms. Soft delete. */
  delete: permitted("CheckDeleteQuote").input(z.object({ quoteId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.$transaction(async (tx) => {
      await tx.quote.update({ where: { id: input.quoteId }, data: { deletedAt: new Date() } });
      await audit(tx, "Quote", input.quoteId, ctx.user.id, { Deleted: [null, "yes"] });
    });
  }),

  addMemo: staffProcedure
    .input(z.object({ quoteId: z.string(), body: z.string().trim().min(1).max(4000), showAsPopup: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.memo.create({ data: { quoteId: input.quoteId, body: input.body, showAsPopup: input.showAsPopup, authorId: ctx.user.id } });
    }),

  /**
   * Email Quote (EmailQuoteRW.aspx: First/Last name, Email, Cc, Phone, Notes) and SMS Quote (SMSQuoteRW.aspx:
   * First/Last name, Email, Cell phone, Provider, Message). Saves the contact on the quote and logs a memo.
   * VERIFY: actual delivery waits for the client's email / SMS provider choice.
   */
  send: staffProcedure
    .input(
      z.object({
        quoteId: z.string(),
        channel: z.enum(["EMAIL", "SMS"]),
        firstName: z.string().trim().max(100).optional().default(""),
        lastName: z.string().trim().max(100).optional().default(""),
        email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email("Invalid email").optional()),
        cc: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email("Invalid email").optional()),
        phone: z.string().trim().max(40).optional().default(""),
        provider: z.string().trim().max(60).optional(),
        notes: z.string().trim().max(4000).optional(),
      })
      .superRefine((v, c) => {
        // EmailQuoteRW.aspx marks only First Name (the email address is still needed to send);
        // SMSQuoteRW.aspx marks First Name, Last Name, Email and Cell Phone
        if (!v.firstName) c.addIssue({ code: "custom", path: ["firstName"], message: "First Name is required" });
        if (!v.email) c.addIssue({ code: "custom", path: ["email"], message: "Email is required" });
        if (v.channel === "SMS") {
          if (!v.lastName) c.addIssue({ code: "custom", path: ["lastName"], message: "Last Name is required" });
          if (!/^\d{10}$/.test(v.phone.replace(/\D/g, ""))) c.addIssue({ code: "custom", path: ["phone"], message: "Cell Phone must be a 10-digit number" });
        }
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.quote.update({
          where: { id: input.quoteId },
          data: {
            firstName: input.firstName || undefined,
            lastName: input.lastName || undefined,
            contactName: [input.firstName, input.lastName].filter(Boolean).join(" ") || undefined,
            email: input.email,
            contactPhone: input.phone || undefined,
          },
        });
        if (input.channel === "EMAIL") return;
        const to = `${input.phone}${input.provider ? ` via ${input.provider}` : ""}`;
        await tx.memo.create({
          data: {
            quoteId: input.quoteId,
            authorId: ctx.user.id,
            body: `SMS quote to ${to} — queued; no SMS provider configured yet.${input.notes ? `
${input.notes}` : ""}`,
          },
        });
      });
      // Email Quote: the quote's template (Settings > Rentals & Invoices, "Quote"), Cc as a second recipient, Notes as the message
      if (input.channel === "EMAIL") {
        const q = await ctx.prisma.quote.findUniqueOrThrow({ where: { id: input.quoteId }, select: { number: true } });
        const to = [input.email!, input.cc].filter(Boolean).join(", ");
        await emailDocument(ctx.prisma, { kind: "QUOTE", id: input.quoteId, to, subject: `Your quote #${q.number} — Mr Rent A Car`, message: input.notes, sentById: ctx.user.id });
        await ctx.prisma.memo.create({ data: { quoteId: input.quoteId, authorId: ctx.user.id, body: `Quote emailed to ${to}${input.notes ? `
${input.notes}` : ""}` } });
      }
    }),
});
