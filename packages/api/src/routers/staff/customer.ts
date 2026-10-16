import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted } from "../../trpc";
import { audit } from "../../lib/audit";

const optStr = z.string().trim().max(2000).optional().nullable().transform((v) => v || null);
const optDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().optional().nullable());
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

/** Add New Customer (CustomerInfo.aspx) — every field on the live form. */
export const customerInput = z.object({
  title: optStr,
  firstName: req("First name"),
  middleName: optStr,
  lastName: req("Last name"),
  gender: optStr,
  birthDate: optDate,
  defaultLocationId: optStr,
  regionId: optStr,

  address1: optStr,
  address2: optStr,
  city: optStr,
  province: optStr,
  postal: optStr,
  country: optStr,
  phone: optStr,
  cellPhone: optStr,
  localPhone: optStr,
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Enter a valid email").nullable().optional()),
  emergencyContactPhone: optStr,

  licenseNumber: optStr,
  licenseExpiry: optDate,
  licenseProvince: optStr,
  licenseCountry: optStr,
  motorcycleLicensed: z.preprocess((v) => (v === "" || v == null ? null : v === "true" || v === true), z.boolean().nullable()),
  passportNumber: optStr,
  identityVerified: z.boolean().default(false),
  checkYotiVerification: z.boolean().default(false),

  insuranceCompany: optStr,
  insurancePolicyNumber: optStr,
  insurancePolicyHolder: optStr,
  insuranceType: z.preprocess((v) => (v === "" ? null : v), z.enum(["LIABILITY_ONLY", "FULL_COVERAGE"]).nullable().optional()),
  insuranceExpiry: optDate,
  insurancePhone: optStr,
  insuranceFax: optStr,
  approvedBy: optStr,

  companyId: optStr,
  companyPhone: optStr,
  jobPosition: optStr,
  referralId: optStr,
  dbaName: optStr,
  taxId: optStr,
  hstNumber: optStr,

  aaaMembershipNumber: optStr,
  frequentTravelerId: optStr,
  bandName: optStr,
  pin: optStr,
  ssn: optStr,

  isUndesired: z.boolean().default(false),
  isPreferred: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isClubMember: z.boolean().default(false),
  unsubscribedFromMarketing: z.boolean().default(false),
  allVehicleBodies: z.boolean().default(false),

  memo: optStr,
  memoShowAsPopup: z.boolean().default(false),
});

/** Candidate duplicates — same rules as the reservation screen's "Check Matching". */
async function findDuplicates(prisma: Prisma.TransactionClient, c: { firstName: string; lastName: string; phone?: string | null; email?: string | null; licenseNumber?: string | null }, excludeId?: string) {
  const digits = (c.phone ?? "").replace(/\D/g, "");
  const or: Prisma.CustomerWhereInput[] = [
    { firstName: { equals: c.firstName, mode: "insensitive" }, lastName: { equals: c.lastName, mode: "insensitive" } },
    { firstName: { equals: c.lastName, mode: "insensitive" }, lastName: { equals: c.firstName, mode: "insensitive" } },
  ];
  if (digits.length >= 7) or.push({ phone: { contains: digits.slice(-7) } });
  if (c.email) or.push({ email: { equals: c.email, mode: "insensitive" } });
  if (c.licenseNumber) or.push({ licenseNumber: { equals: c.licenseNumber, mode: "insensitive" } });
  return prisma.customer.findMany({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    take: 8,
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, licenseNumber: true, birthDate: true, isUndesired: true },
  });
}

function toData(input: z.infer<typeof customerInput>, userId: string, wasVerified: boolean) {
  const { memo: _m, memoShowAsPopup: _p, identityVerified, ...rest } = input;
  return {
    ...rest,
    email: rest.email ?? null,
    identityVerified,
    // manual verification today; Plustek / Plaid fill the same fields later
    ...(identityVerified && !wasVerified ? { identityVerifiedMethod: "MANUAL" as const, identityVerifiedAt: new Date(), identityVerifiedById: userId } : {}),
    ...(!identityVerified ? { identityVerifiedMethod: null, identityVerifiedAt: null, identityVerifiedById: null } : {}),
  };
}

export const customerRouter = router({
  list: permitted("Customers")
    .input(
      z.object({
        search: z.string().optional(),
        active: z.boolean().optional(),
        undesired: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.search?.trim();
      const where: Prisma.CustomerWhereInput = {
        isActive: input.active,
        isUndesired: input.undesired,
        ...(q
          ? {
              OR: [
                { lastName: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { licenseNumber: { contains: q, mode: "insensitive" } },
                { postal: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        ctx.prisma.customer.count({ where }),
        ctx.prisma.customer.findMany({
          where,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true, firstName: true, middleName: true, lastName: true, phone: true, licenseNumber: true, birthDate: true,
            email: true, postal: true, createdAt: true, isActive: true, isUndesired: true,
            defaultLocation: { select: { name: true } },
          },
        }),
      ]);
      return { total, rows };
    }),

  formOptions: staffProcedure.query(async ({ ctx }) => {
    const [locations, regions, companies, referrals] = await Promise.all([
      ctx.prisma.location.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true, isActive: true } }),
      ctx.prisma.lookup.findMany({ where: { kind: "CUSTOMER_REGION", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.referral.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return { locations, regions, companies, referrals };
  }),

  byId: permitted("Customers").input(z.object({ customerId: z.string() })).query(async ({ ctx, input }) => {
    const c = await ctx.prisma.customer.findUnique({
      where: { id: input.customerId },
      include: {
        defaultLocation: { select: { name: true } },
        enteredLocation: { select: { name: true } },
        region: { select: { name: true } },
        company: { select: { id: true, name: true } },
        referral: { select: { name: true } },
        clubMembership: true,
        creditCards: { orderBy: { createdAt: "desc" } },
        memos: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        attachments: { where: { kind: "SCANNED_ID" }, orderBy: { uploadedAt: "desc" } },
        primaryCustomer: { select: { id: true, firstName: true, lastName: true } },
        linkedDrivers: { select: { id: true, firstName: true, lastName: true, licenseNumber: true } },
        rentals: {
          where: { deletedAt: null },
          orderBy: { checkOutAt: "desc" },
          select: { id: true, raNumber: true, status: true, checkOutAt: true, expectedReturnAt: true, checkedInAt: true, vehicle: { select: { assignedId: true } } },
        },
        reservations: {
          where: { deletedAt: null },
          orderBy: { pickupAt: "desc" },
          select: { id: true, number: true, status: true, pickupAt: true, returnAt: true, vehicleType: { select: { name: true } } },
        },
      },
    });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

    const ids = [c.id, ...c.rentals.map((r) => r.id), ...c.reservations.map((r) => r.id)];
    const history = await ctx.prisma.auditLog.findMany({
      where: { entityId: { in: ids } },
      orderBy: { at: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
    });
    const duplicates = await findDuplicates(ctx.prisma, c, c.id);
    return { customer: c, history, duplicates };
  }),

  /** Creation runs the duplicate check; pass ignoreDuplicates after the user confirms. */
  create: permitted("CustomersAdd")
    .input(z.object({ data: customerInput, ignoreDuplicates: z.boolean().default(false), enteredLocationId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!input.ignoreDuplicates) {
        const dups = await findDuplicates(ctx.prisma, input.data);
        if (dups.length) throw new TRPCError({ code: "CONFLICT", message: "POSSIBLE_DUPLICATE", cause: new Error(JSON.stringify(dups)) });
      }
      return ctx.prisma.$transaction(async (tx) => {
        const c = await tx.customer.create({
          data: {
            ...toData(input.data, ctx.user.id, false),
            enteredLocationId: input.enteredLocationId ?? input.data.defaultLocationId,
            registrationChannel: "Staff ERP",
          },
        });
        if (input.data.memo) await tx.memo.create({ data: { customerId: c.id, body: input.data.memo, showAsPopup: input.data.memoShowAsPopup, authorId: ctx.user.id } });
        await audit(tx, "Customer", c.id, ctx.user.id, { Created: [null, `${c.firstName} ${c.lastName}`] });
        return { id: c.id };
      });
    }),

  /** Possible duplicates for the add form (shown before saving). */
  duplicates: staffProcedure
    .input(z.object({ firstName: z.string(), lastName: z.string(), phone: z.string().optional(), email: z.string().optional(), licenseNumber: z.string().optional() }))
    .query(({ ctx, input }) => (input.firstName.length < 1 || input.lastName.length < 2 ? [] : findDuplicates(ctx.prisma, input))),

  update: permitted("CustomersEdit").input(z.object({ customerId: z.string(), data: customerInput })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const before = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
      const data = toData(input.data, ctx.user.id, before.identityVerified);
      await tx.customer.update({ where: { id: before.id }, data });
      if (input.data.memo) await tx.memo.create({ data: { customerId: before.id, body: input.data.memo, showAsPopup: input.data.memoShowAsPopup, authorId: ctx.user.id } });
      const tracked = ["firstName", "lastName", "phone", "email", "licenseNumber", "licenseExpiry", "isUndesired", "isActive", "identityVerified"] as const;
      await audit(tx, "Customer", before.id, ctx.user.id, Object.fromEntries(tracked.map((k) => [k, [before[k], (data as Record<string, unknown>)[k]]])));
      return { id: before.id };
    }),
  ),

  setActive: permitted("CustomersDelete").input(z.object({ customerId: z.string(), isActive: z.boolean() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({ where: { id: input.customerId }, data: { isActive: input.isActive } });
      await audit(tx, "Customer", c.id, ctx.user.id, { Active: [!input.isActive, input.isActive] });
    }),
  ),

  saveClubMembership: staffProcedure
    .input(
      z.object({
        customerId: z.string(),
        gCode: optStr,
        cardNumber: optStr,
        issuedAt: optDate,
        expiresAt: optDate,
        sentAt: optDate,
        status: optStr,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { customerId, ...data } = input;
      await ctx.prisma.$transaction([
        ctx.prisma.clubMembership.upsert({ where: { customerId }, update: data, create: { customerId, ...data } }),
        ctx.prisma.customer.update({ where: { id: customerId }, data: { isClubMember: true } }),
      ]);
    }),

  /** Cards are stored as brand + last 4 + expiry only — never the full number or CVV. */
  addCreditCard: staffProcedure
    .input(
      z.object({
        customerId: z.string(),
        description: optStr,
        brand: req("Card type"),
        last4: z.string().regex(/^\d{4}$/, "Last 4 digits only"),
        expMonth: z.coerce.number().int().min(1).max(12),
        expYear: z.coerce.number().int().min(2000).max(2100),
        holderName: optStr,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.creditCard.create({ data: input });
    }),

  setCreditCardActive: staffProcedure.input(z.object({ creditCardId: z.string(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.creditCard.update({ where: { id: input.creditCardId }, data: { isActive: input.isActive } });
  }),

  addNote: staffProcedure
    .input(z.object({ customerId: z.string(), body: z.string().trim().min(1).max(4000), showAsPopup: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.memo.create({ data: { customerId: input.customerId, kind: "NOTE", body: input.body, showAsPopup: input.showAsPopup, authorId: ctx.user.id } });
    }),
});
