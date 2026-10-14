import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { withBookingGuard } from "../../lib/errors";
import { priceBooking } from "../../lib/pricing";
import { billSplitData, billSplitInput, transportInput } from "../../lib/bill-split";

const D = (n: number) => new Prisma.Decimal(n);
const optStr = z.string().trim().max(2000).optional().nullable().transform((v) => v || null);
const optDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().optional().nullable());
const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nonnegative().nullable());
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

const PAYMENT_METHODS = ["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"] as const;
const ACTIVE = ["TENTATIVE", "CONFIRMED"] as const;

const customerInput = z.object({
  firstName: req("First name"),
  middleName: optStr,
  lastName: req("Last name"),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Enter a valid email").nullable().optional()),
  phone: optStr,
  localPhone: optStr,
  licenseNumber: optStr,
  licenseExpiry: optDate,
  licenseProvince: optStr,
  birthDate: optDate,
  address1: optStr,
  address2: optStr,
  city: optStr,
  province: optStr,
  postal: optStr,
  country: optStr,
  insuranceCompany: optStr,
  insurancePolicyNumber: optStr,
  insuranceExpiry: optDate,
  insurancePhone: optStr,
  insuranceFax: optStr,
  memo: optStr,
});

/** New Reservation ("Reserve") — every field from the live form's Customer + Reservation tabs + Payment panel. */
const reservationInput = z
  .object({
    status: z.enum(ACTIVE).default("TENTATIVE"),
    quoteId: optStr,
    customerId: optStr,
    saveCustomer: z.boolean().default(true),
    allowUndesired: z.boolean().default(false),
    customer: customerInput,

    locationId: req("Location"),
    pickupLocationId: req("Pickup location"),
    returnLocationId: req("Return location"),
    pickupAt: z.coerce.date({ required_error: "Pickup date is required", invalid_type_error: "Pickup date is required" }),
    returnAt: z.coerce.date({ required_error: "Return date is required", invalid_type_error: "Return date is required" }),
    vehicleTypeId: req("Vehicle type"),
    vehicleId: optStr,
    rateId: optStr,
    companyId: optStr,
    discountType: z.preprocess((v) => (v === "" ? null : v), z.enum(["PERCENT", "AMOUNT"]).nullable().optional()),
    discountValue: optNum,
    discountReasonId: optStr,
    deposit: optNum,
    referralId: optStr,
    deliveryAddress: optStr,
    airline: optStr,
    flightNumber: optStr,
    hotel: optStr,
    arrivalAirport: optStr,
    preferredLanguage: optStr,
    poNumber: optStr,
    roNumber: optStr,
    customerNotes: optStr,
    isLoaner: z.boolean().default(false),
    isNonRevenue: z.boolean().default(false),
    memo: optStr,
    memoShowAsPopup: z.boolean().default(false),
    miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.coerce.number().int().min(0) })).default([]),
    insuranceId: optStr,
    payment: z
      .object({
        method: z.enum(PAYMENT_METHODS),
        transactionType: z.enum(["PAYMENT", "AUTHORIZATION", "REFUND"]),
        amount: z.coerce.number().positive("Payment amount must be more than 0"),
        authorizationCode: optStr,
        transactionCode: optStr,
        cardLast4: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}$/, "Last 4 digits only").nullable().optional()),
      })
      .nullable()
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.returnAt <= v.pickupAt) ctx.addIssue({ code: "custom", path: ["returnAt"], message: "Return must be after pickup" });
    if (v.discountType && v.discountType === "PERCENT" && (v.discountValue ?? 0) > 100)
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Discount can't exceed 100%" });
  });

export type ReservationInput = z.infer<typeof reservationInput>;

const pricingInput = z.object({
  pickupAt: z.coerce.date(),
  returnAt: z.coerce.date(),
  locationId: z.string(),
  vehicleTypeId: z.string(),
  rateId: z.string().optional().nullable(),
  discountType: z.enum(["PERCENT", "AMOUNT"]).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.number().int().min(0) })).default([]),
  insuranceId: z.string().optional().nullable(),
});

async function upsertCustomer(tx: Prisma.TransactionClient, input: ReservationInput, enteredLocationId: string) {
  const { memo, ...c } = input.customer;
  if (input.customerId) {
    const existing = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    if (existing.isUndesired && !input.allowUndesired)
      throw new TRPCError({ code: "CONFLICT", message: "UNDESIRED_CUSTOMER" });
    if (input.saveCustomer) await tx.customer.update({ where: { id: existing.id }, data: c });
    return existing.id;
  }
  if (!input.saveCustomer) return null;
  const created = await tx.customer.create({ data: { ...c, enteredLocationId, defaultLocationId: enteredLocationId } });
  if (memo) await tx.memo.create({ data: { customerId: created.id, body: memo } });
  return created.id;
}

async function writeBooking(
  tx: Prisma.TransactionClient,
  userId: string,
  input: ReservationInput,
  existingId?: string,
) {
  if (input.companyId && !input.allowUndesired) {
    const co = await tx.company.findUnique({ where: { id: input.companyId } });
    if (co?.isUndesired) throw new TRPCError({ code: "CONFLICT", message: "UNDESIRED_COMPANY" });
  }
  if (input.vehicleId) {
    const v = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } });
    if (v.vehicleTypeId !== input.vehicleTypeId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "The assigned vehicle is a different type from the reserved type." });
  }

  const customerId = await upsertCustomer(tx, input, input.locationId);
  const priced = await priceBooking(tx, {
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    locationId: input.pickupLocationId,
    vehicleTypeId: input.vehicleTypeId,
    rateId: input.rateId,
    discountType: input.discountType,
    discountValue: input.discountValue,
    miscCharges: input.miscCharges,
    insuranceId: input.insuranceId,
  });

  const data = {
    status: input.status,
    customerId,
    firstName: input.customer.firstName,
    middleName: input.customer.middleName,
    lastName: input.customer.lastName,
    email: input.customer.email ?? null,
    phone: input.customer.phone,
    locationId: input.locationId,
    pickupLocationId: input.pickupLocationId,
    returnLocationId: input.returnLocationId,
    pickupAt: input.pickupAt,
    returnAt: input.returnAt,
    vehicleTypeId: input.vehicleTypeId,
    vehicleId: input.vehicleId,
    rateId: input.rateId,
    companyId: input.companyId,
    discountType: input.discountType ?? null,
    discountValue: input.discountValue == null ? null : D(input.discountValue),
    discountReasonId: input.discountReasonId,
    deposit: input.deposit == null ? null : D(input.deposit),
    referralId: input.referralId,
    deliveryAddress: input.deliveryAddress,
    airline: input.airline,
    flightNumber: input.flightNumber,
    hotel: input.hotel,
    arrivalAirport: input.arrivalAirport,
    preferredLanguage: input.preferredLanguage,
    poNumber: input.poNumber,
    roNumber: input.roNumber,
    customerNotes: input.customerNotes,
    isLoaner: input.isLoaner,
    isNonRevenue: input.isNonRevenue,
  };

  let reservationId: string;
  if (existingId) {
    const before = await tx.reservation.findUniqueOrThrow({ where: { id: existingId } });
    await tx.reservation.update({ where: { id: existingId }, data });
    await tx.chargeLine.deleteMany({ where: { reservationId: existingId } });
    await audit(tx, "Reservation", existingId, userId, {
      Status: [before.status, data.status],
      PickupDate: [before.pickupAt, data.pickupAt],
      ReturnDate: [before.returnAt, data.returnAt],
      VehicleType: [before.vehicleTypeId, data.vehicleTypeId],
      Vehicle: [before.vehicleId, data.vehicleId],
    });
    reservationId = existingId;
  } else {
    const r = await tx.reservation.create({ data: { ...data, quoteId: input.quoteId, reservationChannel: "Staff ERP", createdById: userId } });
    await audit(tx, "Reservation", r.id, userId, { ReservationNumber: [null, r.number] });
    reservationId = r.id;
  }

  await tx.chargeLine.createMany({ data: priced.lines.map((l) => ({ ...l, reservationId })) });

  // availability block — the exclusion constraint rejects double-booking
  await tx.vehicleBlock.deleteMany({ where: { reservationId } });
  if (input.vehicleId)
    await tx.vehicleBlock.create({ data: { vehicleId: input.vehicleId, reservationId, startsAt: input.pickupAt, endsAt: input.returnAt } });

  if (input.memo) await tx.memo.create({ data: { reservationId, body: input.memo, showAsPopup: input.memoShowAsPopup, authorId: userId } });
  if (input.payment)
    await tx.payment.create({
      data: { ...input.payment, amount: D(input.payment.amount), reservationId, customerId, takenById: userId },
    });
  return reservationId;
}

export const reservationRouter = router({
  /**
   * ReservationsSearch.aspx: quick search (Reservation # OR First Name OR Last Name) + Advanced Search
   * (Reservation#, First/Last Name, Vehicle ID, Phone Number, Vehicle Type, Loc. Name, Company Name,
   * Pickup Date Begin/End, Loc. Out, Loc. In, Status, National ID/SSN). Sorted by Reservation# descending.
   */
  list: staffProcedure
    .input(
      z.object({
        search: z.string().optional(),
        number: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        vehicleAssignedId: z.string().optional(),
        phone: z.string().optional(),
        vehicleTypeId: z.string().optional(),
        locationId: z.string().optional(),
        companyName: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        pickupLocationId: z.string().optional(),
        returnLocationId: z.string().optional(),
        /** RentCentric status filter: Honored | Confirmed | Cancelled | Tentative | Pending | Null */
        legacyStatus: z.enum(["Honored", "Confirmed", "Cancelled", "Tentative", "Pending", "Null"]).optional(),
        ssn: z.string().optional(),
        status: z.enum(["TENTATIVE", "CONFIRMED", "CHECKED_OUT", "CHECKED_IN", "CANCELLED", "NO_SHOW"]).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const t = (v?: string) => v?.trim() || undefined;
      const q = t(input.search);
      const n = q && /^\d+$/.test(q) ? Number(q) : undefined;
      const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
      const STATUS: Record<string, Prisma.ReservationWhereInput["status"]> = {
        Honored: { in: ["CHECKED_OUT", "CHECKED_IN"] },
        Confirmed: "CONFIRMED",
        Cancelled: "CANCELLED",
        Tentative: "TENTATIVE",
        // no Pending / Null reservations exist in this system
        Pending: { in: [] },
        Null: { in: [] },
      };
      const num = t(input.number);
      const and: Prisma.ReservationWhereInput[] = [
        ...(q ? [{ OR: [...(n ? [{ number: n }] : []), { firstName: ci(q) }, { lastName: ci(q) }] }] : []),
        ...(num && /^\d+$/.test(num) ? [{ number: Number(num) }] : []),
        ...(t(input.firstName) ? [{ firstName: ci(t(input.firstName)!) }] : []),
        ...(t(input.lastName) ? [{ lastName: ci(t(input.lastName)!) }] : []),
        ...(t(input.vehicleAssignedId) ? [{ vehicle: { assignedId: ci(t(input.vehicleAssignedId)!) } }] : []),
        ...(t(input.phone) ? [{ phone: { contains: t(input.phone)! } }] : []),
        ...(t(input.companyName) ? [{ company: { name: ci(t(input.companyName)!) } }] : []),
        ...(t(input.ssn) ? [{ customer: { ssn: { contains: t(input.ssn)! } } }] : []),
      ];
      const where: Prisma.ReservationWhereInput = {
        deletedAt: null,
        status: input.legacyStatus ? STATUS[input.legacyStatus] : input.status,
        vehicleTypeId: t(input.vehicleTypeId),
        locationId: t(input.locationId),
        pickupLocationId: t(input.pickupLocationId),
        returnLocationId: t(input.returnLocationId),
        pickupAt: { gte: input.from, lte: input.to },
        AND: and,
      };
      const [total, rows] = await Promise.all([
        ctx.prisma.reservation.count({ where }),
        ctx.prisma.reservation.findMany({
          where,
          orderBy: { number: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true, number: true, status: true, firstName: true, lastName: true, pickupAt: true, returnAt: true,
            pickupLocation: { select: { name: true, timeZone: true } }, returnLocation: { select: { name: true } },
            vehicleType: { select: { name: true } }, vehicle: { select: { assignedId: true } },
          },
        }),
      ]);
      return { total, rows };
    }),

  formOptions: staffProcedure.query(async ({ ctx }) => {
    const [locations, vehicleTypes, rates, companies, referrals, discountReasons, miscCharges] = await Promise.all([
      ctx.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, timeZone: true } }),
      ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.rate.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, locationId: true, values: { select: { vehicleTypeId: true } } },
      }),
      ctx.prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, isUndesired: true } }),
      ctx.prisma.referral.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.lookup.findMany({ where: { kind: "DISCOUNT_REASON", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.miscCharge.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, rate: true, calculationBy: true, locationId: true, isDefault: true, group: true },
      }),
    ]);
    const insurances = await ctx.prisma.insurance.findMany({
      where: { isActive: true },
      orderBy: [{ dailyRate: "asc" }, { name: "asc" }],
      select: { id: true, name: true, dailyRate: true, deductible: true, locationId: true, isDefault: true },
    });
    const paymentDetails = await ctx.prisma.lookup.findMany({ where: { kind: "PAYMENT_DETAIL", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } });
    return {
      paymentDetails: paymentDetails.map((p) => p.name),
      locations,
      insurances,
      vehicleTypes,
      rates: rates.map((r) => ({ id: r.id, code: r.code, locationId: r.locationId, vehicleTypeIds: r.values.map((v) => v.vehicleTypeId) })),
      companies,
      referrals,
      discountReasons,
      miscCharges,
    };
  }),

  /** Live charge preview for the form. */
  preview: staffProcedure.input(pricingInput).query(async ({ ctx, input }) => {
    if (input.returnAt <= input.pickupAt) return null;
    return priceBooking(ctx.prisma, input);
  }),

  /** "Check Matching": possible duplicates of the customer being typed in. */
  checkMatching: staffProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        licenseNumber: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const digits = (input.phone ?? "").replace(/\D/g, "");
      const or: Prisma.CustomerWhereInput[] = [];
      if (input.lastName && input.lastName.length >= 2)
        or.push({
          lastName: { equals: input.lastName.trim(), mode: "insensitive" },
          ...(input.firstName ? { firstName: { startsWith: input.firstName.trim().slice(0, 1), mode: "insensitive" } } : {}),
        });
      // legacy duplicates had first/last swapped ("CAO HAN" / "HAN CAO")
      if (input.firstName && input.lastName)
        or.push({ firstName: { equals: input.lastName.trim(), mode: "insensitive" }, lastName: { equals: input.firstName.trim(), mode: "insensitive" } });
      if (digits.length >= 7) or.push({ phone: { contains: digits.slice(-7) } });
      if (input.email && input.email.includes("@")) or.push({ email: { equals: input.email.trim(), mode: "insensitive" } });
      if (input.licenseNumber && input.licenseNumber.length >= 4) or.push({ licenseNumber: { equals: input.licenseNumber.trim(), mode: "insensitive" } });
      if (!or.length) return [];
      return ctx.prisma.customer.findMany({
        where: { OR: or },
        take: 8,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, firstName: true, middleName: true, lastName: true, phone: true, localPhone: true, email: true, licenseNumber: true,
          licenseExpiry: true, licenseProvince: true, birthDate: true, address1: true, address2: true, city: true, province: true,
          postal: true, country: true, insuranceCompany: true, insurancePolicyNumber: true, insuranceExpiry: true, insurancePhone: true,
          insuranceFax: true, isUndesired: true, isActive: true,
        },
      });
    }),

  /** Vehicles of a type at a location that are free for the whole window. */
  availableVehicles: staffProcedure
    .input(
      z.object({
        vehicleTypeId: z.string(),
        locationId: z.string(),
        pickupAt: z.coerce.date(),
        returnAt: z.coerce.date(),
        excludeReservationId: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.prisma.vehicle.findMany({
        where: {
          isActive: true,
          vehicleTypeId: input.vehicleTypeId,
          rentalLocationId: input.locationId,
          status: { in: ["AVAILABLE", "ON_RENT"] },
          blocks: {
            none: {
              startsAt: { lt: input.returnAt },
              endsAt: { gt: input.pickupAt },
              ...(input.excludeReservationId ? { NOT: { reservationId: input.excludeReservationId } } : {}),
            },
          },
        },
        orderBy: { assignedId: "asc" },
        select: { id: true, assignedId: true, year: true, currentOdometer: true, make: { select: { name: true } }, model: { select: { name: true } } },
      }),
    ),

  create: staffProcedure.input(reservationInput).mutation(({ ctx, input }) =>
    withBookingGuard(async () => ({ id: await ctx.prisma.$transaction((tx) => writeBooking(tx, ctx.user.id, input)) })),
  ),

  update: staffProcedure.input(z.object({ reservationId: z.string(), data: reservationInput })).mutation(({ ctx, input }) =>
    withBookingGuard(async () => {
      const r = await ctx.prisma.reservation.findFirst({ where: { id: input.reservationId, deletedAt: null } });
      if (!r) throw new TRPCError({ code: "NOT_FOUND" });
      if (!(ACTIVE as readonly string[]).includes(r.status))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only tentative or confirmed reservations can be edited." });
      await ctx.prisma.$transaction((tx) => writeBooking(tx, ctx.user.id, { ...input.data, payment: null }, r.id));
      return { id: r.id };
    }),
  ),

  byId: staffProcedure.input(z.object({ reservationId: z.string() })).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.reservation.findFirst({
      where: { id: input.reservationId, deletedAt: null },
      include: {
        customer: true,
        company: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        pickupLocation: { select: { id: true, name: true, address1: true, city: true, province: true, postal: true, country: true, phone: true, fax: true, email: true, timeZone: true } },
        returnLocation: { select: { id: true, name: true } },
        vehicleType: { select: { id: true, name: true, description: true, seats: true, doors: true, luggage: true, imageKey: true, transmission: true } },
        vehicle: { select: { id: true, assignedId: true, year: true, currentOdometer: true, fuelLevel: true, make: { select: { name: true } }, model: { select: { name: true } } } },
        rate: { select: { id: true, code: true, graceMinutes: true, fuelChargePerUnit: true, values: true } },
        referral: { select: { name: true } },
        discountReason: { select: { name: true } },
        createdBy: { select: { name: true } },
        quote: { select: { id: true, number: true } },
        rental: { select: { id: true, raNumber: true } },
        chargeLines: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: { tax: { select: { kind: true } }, miscCharge: { select: { calculationBy: true } } },
        },
        payments: { orderBy: { takenAt: "asc" }, include: { takenBy: { select: { name: true } } } },
        drivers: { include: { customer: true } },
        memos: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        transports: { include: { pickupLocation: { select: { name: true } }, dropoffLocation: { select: { name: true } } } },
        billSplits: { include: { company: { select: { name: true, code: true } } } },
      },
    });
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found" });
    const auditLog = await ctx.prisma.auditLog.findMany({
      where: { entityType: "Reservation", entityId: r.id },
      orderBy: { at: "desc" },
      include: { user: { select: { name: true } } },
    });
    const total = r.chargeLines.reduce((a, l) => a.add(l.total), D(0));
    const paid = r.payments
      .filter((p) => p.transactionType !== "AUTHORIZATION")
      .reduce((a, p) => (p.transactionType === "REFUND" ? a.sub(p.amount) : a.add(p.amount)), D(0));
    return { reservation: r, totals: { total, totalPayments: paid, balance: total.sub(paid) }, auditLog };
  }),

  // ── lifecycle ────────────────────────────────────────────────────────────────
  setStatus: staffProcedure
    .input(z.object({ reservationId: z.string(), status: z.enum(["TENTATIVE", "CONFIRMED", "CANCELLED", "NO_SHOW"]), reason: optStr }))
    .mutation(({ ctx, input }) =>
      withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          const r = await tx.reservation.findFirst({ where: { id: input.reservationId, deletedAt: null } });
          if (!r) throw new TRPCError({ code: "NOT_FOUND" });
          if (r.status === "CHECKED_OUT" || r.status === "CHECKED_IN")
            throw new TRPCError({ code: "BAD_REQUEST", message: "This reservation has already become a rental." });
          const releasing = input.status === "CANCELLED" || input.status === "NO_SHOW";
          await tx.reservation.update({
            where: { id: r.id },
            data: { status: input.status, cancelledAt: input.status === "CANCELLED" ? new Date() : null },
          });
          if (releasing) await tx.vehicleBlock.deleteMany({ where: { reservationId: r.id } });
          else if (r.vehicleId && !(await tx.vehicleBlock.findUnique({ where: { reservationId: r.id } })))
            await tx.vehicleBlock.create({ data: { vehicleId: r.vehicleId, reservationId: r.id, startsAt: r.pickupAt, endsAt: r.returnAt } });
          if (input.reason) await tx.memo.create({ data: { reservationId: r.id, authorId: ctx.user.id, body: `${input.status === "CANCELLED" ? "Cancelled" : "Status changed"}: ${input.reason}` } });
          await audit(tx, "Reservation", r.id, ctx.user.id, { Status: [r.status, input.status] });
        }),
      ),
    ),

  delete: staffProcedure.input(z.object({ reservationId: z.string(), confirmNumber: z.coerce.number().int() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirstOrThrow({ where: { id: input.reservationId, deletedAt: null } });
      if (r.number !== input.confirmNumber) throw new TRPCError({ code: "BAD_REQUEST", message: "Reservation number doesn't match." });
      if (r.status === "CHECKED_OUT") throw new TRPCError({ code: "BAD_REQUEST", message: "Delete the rental instead — this reservation has been honored." });
      await tx.reservation.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
      await tx.vehicleBlock.deleteMany({ where: { reservationId: r.id } });
      await audit(tx, "Reservation", r.id, ctx.user.id, { Deleted: [null, "yes"] });
    }),
  ),

  duplicate: staffProcedure.input(z.object({ reservationId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirstOrThrow({ where: { id: input.reservationId }, include: { chargeLines: true } });
      const { id: _id, number: _n, legacyId: _l, createdAt: _c, updatedAt: _u, cancelledAt: _x, deletedAt: _d, quoteId: _q, chargeLines, vehicleId: _v, status: _s, confirmationEmailSentAt: _e, ...copy } = r;
      const dup = await tx.reservation.create({ data: { ...copy, status: "TENTATIVE", vehicleId: null, createdById: ctx.user.id } });
      await tx.chargeLine.createMany({
        data: chargeLines.map(({ id: _i, quoteId: _qq, rentalId: _r, reservationId: _rr, ...l }) => ({ ...l, reservationId: dup.id })),
      });
      await audit(tx, "Reservation", dup.id, ctx.user.id, { DuplicatedFrom: [null, r.number] });
      return { id: dup.id };
    }),
  ),

  /** "Move Reservation": reassign the reservation to a different customer. */
  moveToCustomer: staffProcedure.input(z.object({ reservationId: z.string(), customerId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findFirstOrThrow({ where: { id: input.reservationId, deletedAt: null } });
      const c = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId } });
      await tx.reservation.update({
        where: { id: r.id },
        data: { customerId: c.id, firstName: c.firstName, middleName: c.middleName, lastName: c.lastName, email: c.email, phone: c.phone },
      });
      await audit(tx, "Reservation", r.id, ctx.user.id, { Customer: [`${r.firstName} ${r.lastName}`, `${c.firstName} ${c.lastName}`] });
    }),
  ),

  /** "Start Rental" from a reservation: opens a Rental with the same booking, recalculated charges. */
  startRental: staffProcedure
    .input(
      z.object({
        reservationId: z.string(),
        vehicleId: req("Vehicle"),
        checkOutAt: z.coerce.date(),
        odometerOut: z.coerce.number().int().nonnegative(),
        fuelOut: z.coerce.number().int().min(0).max(16),
        checkOutChannel: optStr,
      }),
    )
    .mutation(({ ctx, input }) =>
      withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          const r = await tx.reservation.findFirst({
            where: { id: input.reservationId, deletedAt: null },
            include: { chargeLines: true, drivers: true, payments: true },
          });
          if (!r) throw new TRPCError({ code: "NOT_FOUND" });
          if (!(ACTIVE as readonly string[]).includes(r.status))
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only tentative or confirmed reservations can be started." });
          if (!r.customerId)
            throw new TRPCError({ code: "BAD_REQUEST", message: "Save the renter as a customer first (licence details are needed for the agreement)." });
          const v = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } });

          await tx.vehicleBlock.deleteMany({ where: { reservationId: r.id } });
          const rental = await tx.rental.create({
            data: {
              reservationId: r.id,
              quoteId: r.quoteId,
              customerId: r.customerId,
              companyId: r.companyId,
              checkOutLocationId: r.pickupLocationId,
              checkInLocationId: r.returnLocationId,
              checkOutAt: input.checkOutAt,
              expectedReturnAt: r.returnAt,
              checkOutChannel: input.checkOutChannel,
              vehicleTypeId: v.vehicleTypeId,
              vehicleId: v.id,
              odometerOut: input.odometerOut,
              fuelOut: input.fuelOut,
              rateId: r.rateId,
              discountType: r.discountType,
              discountValue: r.discountValue,
              discountReasonId: r.discountReasonId,
              deposit: r.deposit,
              referralId: r.referralId,
              airline: r.airline,
              flightNumber: r.flightNumber,
              poNumber: r.poNumber,
              roNumber: r.roNumber,
              isNonRevenue: r.isNonRevenue,
              openedById: ctx.user.id,
              drivers: { create: r.drivers.map((d) => ({ customerId: d.customerId })) },
              chargeLines: {
                create: r.chargeLines.map(({ kind, name, units, rate, total, miscChargeId, taxId, sortOrder }) => ({ kind, name, units, rate, total, miscChargeId, taxId, sortOrder })),
              },
              vehicleSegments: { create: [{ vehicleId: v.id, startsAt: input.checkOutAt, odometerOut: input.odometerOut, fuelOut: input.fuelOut }] },
            },
          });
          // payments, bill splits and pickup/drop-off move to the rental
          await tx.payment.updateMany({ where: { reservationId: r.id }, data: { rentalId: rental.id } });
          await tx.billSplit.updateMany({ where: { reservationId: r.id }, data: { rentalId: rental.id, reservationId: null } });
          await tx.transport.updateMany({ where: { reservationId: r.id }, data: { rentalId: rental.id, reservationId: null } });
          await tx.vehicleBlock.create({ data: { vehicleId: v.id, rentalId: rental.id, startsAt: input.checkOutAt, endsAt: r.returnAt } });
          await tx.vehicle.update({ where: { id: v.id }, data: { status: "ON_RENT", currentOdometer: input.odometerOut, fuelLevel: input.fuelOut } });
          await tx.reservation.update({ where: { id: r.id }, data: { status: "CHECKED_OUT", vehicleId: v.id } });
          await audit(tx, "Reservation", r.id, ctx.user.id, { Status: [r.status, "CHECKED_OUT"] });
          await audit(tx, "Rental", rental.id, ctx.user.id, { RANumber: ["Start Rental", rental.raNumber] });
          return { rentalId: rental.id };
        }),
      ),
    ),

  addPayment: staffProcedure
    .input(
      z.object({
        reservationId: z.string(),
        method: z.enum(PAYMENT_METHODS),
        transactionType: z.enum(["PAYMENT", "AUTHORIZATION", "REFUND"]),
        amount: z.coerce.number().positive(),
        authorizationCode: optStr,
        transactionCode: optStr,
        cardLast4: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}$/).nullable().optional()),
        takenAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.prisma.reservation.findFirstOrThrow({ where: { id: input.reservationId, deletedAt: null } });
      const { reservationId, amount, ...rest } = input;
      await ctx.prisma.payment.create({ data: { ...rest, reservationId, amount: D(amount), customerId: r.customerId, takenById: ctx.user.id } });
    }),

  addDriver: staffProcedure.input(z.object({ reservationId: z.string(), customerId: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    if (c.isUndesired) throw new TRPCError({ code: "BAD_REQUEST", message: "This customer is on the undesired (do-not-rent) list." });
    await ctx.prisma.bookingDriver.create({ data: { reservationId: input.reservationId, customerId: input.customerId } });
  }),

  removeDriver: staffProcedure.input(z.object({ bookingDriverId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.bookingDriver.delete({ where: { id: input.bookingDriverId } });
  }),

  addMemo: staffProcedure
    .input(z.object({ reservationId: z.string(), body: z.string().trim().min(1).max(4000), showAsPopup: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.memo.create({ data: { reservationId: input.reservationId, body: input.body, showAsPopup: input.showAsPopup, authorId: ctx.user.id } });
    }),

  addBillSplit: staffProcedure.input(z.object({ reservationId: z.string() }).merge(billSplitInput)).mutation(async ({ ctx, input }) => {
    const { reservationId, ...rest } = input;
    await ctx.prisma.reservation.findFirstOrThrow({ where: { id: reservationId, deletedAt: null } });
    await ctx.prisma.billSplit.create({ data: { ...billSplitData(rest), reservationId } });
  }),

  removeBillSplit: staffProcedure.input(z.object({ billSplitId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.billSplit.delete({ where: { id: input.billSplitId } });
  }),

  addTransport: staffProcedure.input(z.object({ reservationId: z.string() }).merge(transportInput)).mutation(async ({ ctx, input }) => {
    const { reservationId, ...rest } = input;
    await ctx.prisma.reservation.findFirstOrThrow({ where: { id: reservationId, deletedAt: null } });
    await ctx.prisma.transport.create({ data: { ...rest, reservationId } });
  }),
});
