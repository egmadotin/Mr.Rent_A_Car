import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { rentalTotals } from "../../lib/totals";
import { withBookingGuard } from "../../lib/errors";
import { billSplitData, billSplitInput, transportInput } from "../../lib/bill-split";

const D = (n: number) => new Prisma.Decimal(n);
const id = z.object({ rentalId: z.string() });
const money = z.coerce.number().finite();
const optStr = z.string().trim().max(500).optional().transform((v) => v || null);
const optDate = z.coerce.date().optional().nullable();

const PAYMENT_METHODS = ["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"] as const;
const CHARGE_KINDS = [
  "TIME", "MILEAGE", "UPGRADE", "DISCOUNT", "FUEL", "PREPAID_FUEL", "MISC", "ONE_WAY", "DAMAGES",
  "TRAFFIC_TICKETS", "ADMIN", "OTHER",
] as const;

async function loadRental(prisma: Prisma.TransactionClient, rentalId: string) {
  const r = await prisma.rental.findFirst({ where: { id: rentalId, deletedAt: null } });
  if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Rental not found" });
  return r;
}

/** Keep the single TRAFFIC_TICKETS charge line equal to the sum of the rental's tickets (legacy behaviour). */
async function syncTicketLine(tx: Prisma.TransactionClient, rentalId: string) {
  const agg = await tx.trafficTicket.aggregate({ where: { rentalId }, _sum: { amount: true } });
  const total = agg._sum.amount ?? D(0);
  await tx.chargeLine.deleteMany({ where: { rentalId, kind: "TRAFFIC_TICKETS" } });
  if (!total.isZero())
    await tx.chargeLine.create({
      data: { rentalId, kind: "TRAFFIC_TICKETS", name: "Traffic Tickets", units: D(1), rate: total, total, sortOrder: 7 },
    });
}

export const rentalRouter = router({
  list: staffProcedure
    .input(
      z.object({
        status: z.enum(["OPEN", "CLOSED", "VOIDED"]).optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.search?.trim();
      const asNumber = q && /^\d+$/.test(q) ? Number(q) : undefined;
      const where: Prisma.RentalWhereInput = {
        deletedAt: null,
        status: input.status,
        ...(q
          ? {
              OR: [
                ...(asNumber ? [{ raNumber: asNumber }] : []),
                { customer: { lastName: { contains: q, mode: "insensitive" } } },
                { customer: { firstName: { contains: q, mode: "insensitive" } } },
                { vehicle: { assignedId: { contains: q, mode: "insensitive" } } },
                { company: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      };
      const [total, rows] = await Promise.all([
        ctx.prisma.rental.count({ where }),
        ctx.prisma.rental.findMany({
          where,
          orderBy: { checkOutAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            raNumber: true,
            status: true,
            checkOutAt: true,
            expectedReturnAt: true,
            checkedInAt: true,
            customer: { select: { firstName: true, lastName: true } },
            company: { select: { name: true } },
            vehicleType: { select: { name: true } },
            vehicle: { select: { assignedId: true } },
            checkOutLocation: { select: { name: true } },
            checkInLocation: { select: { name: true } },
          },
        }),
      ]);
      return { total, rows };
    }),

  byId: staffProcedure.input(id).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.rental.findFirst({
      where: { id: input.rentalId, deletedAt: null },
      include: {
        customer: true,
        company: { select: { id: true, name: true } },
        vehicle: { include: { make: true, model: true } },
        vehicleType: true,
        checkOutLocation: { select: { id: true, name: true } },
        checkInLocation: { select: { id: true, name: true } },
        referral: { select: { name: true } },
        rentalReason: { select: { name: true } },
        rate: { select: { code: true } },
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
        reservation: { select: { id: true, number: true } },
        chargeLines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { tax: { select: { kind: true } } } },
        payments: { orderBy: { takenAt: "asc" }, include: { takenBy: { select: { name: true } }, company: { select: { name: true } } } },
        drivers: { include: { customer: true } },
        memos: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        vehicleSegments: { orderBy: [{ sequence: "asc" }, { startsAt: "asc" }], include: { vehicle: { include: { make: true, model: true } } } },
        trafficTickets: { orderBy: { ticketDate: "desc" } },
        adjustments: { orderBy: { enteredAt: "desc" }, include: { enteredBy: { select: { name: true } } } },
        billSplits: { include: { company: { select: { name: true, code: true, phone: true } }, taxes: { include: { tax: true } } } },
        commissions: { include: { referral: { select: { name: true } }, user: { select: { name: true } }, enteredBy: { select: { name: true } } } },
        claims: { orderBy: { claimDate: "desc" } },
        invoices: { orderBy: { beginDate: "asc" } },
        transports: { include: { pickupLocation: { select: { name: true } }, dropoffLocation: { select: { name: true } } } },
      },
    });
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Rental not found" });

    const [auditLog, customerOpenBalance] = await Promise.all([
      ctx.prisma.auditLog.findMany({
        where: { entityType: "Rental", entityId: r.id },
        orderBy: { at: "desc" },
        include: { user: { select: { name: true } } },
      }),
      // Customer Balance: what this customer owes across their other rentals
      ctx.prisma.rental.findMany({
        where: { customerId: r.customerId, deletedAt: null, status: { not: "VOIDED" }, id: { not: r.id } },
        select: { chargeLines: { select: { kind: true, total: true, tax: { select: { kind: true } } } }, payments: { select: { transactionType: true, amount: true } }, billSplits: true },
      }),
    ]);
    const otherBalance = customerOpenBalance
      .map((o) => rentalTotals(o.chargeLines, o.payments, o.billSplits).balance)
      .reduce((a, b) => a.add(b), D(0));
    const totals = rentalTotals(r.chargeLines, r.payments, r.billSplits);

    return { rental: r, totals, customerBalance: otherBalance.add(totals.balance), auditLog };
  }),

  /** Pick-lists for the rental screen's dialogs. */
  formOptions: staffProcedure.query(async ({ ctx }) => {
    const [locations, companies, miscCharges, taxes, referrals, staff, vehicles] = await Promise.all([
      ctx.prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
      ctx.prisma.miscCharge.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.tax.findMany({ where: { isActive: true }, select: { id: true, name: true, kind: true, value: true } }),
      ctx.prisma.referral.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.user.findMany({ where: { kind: "STAFF" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.vehicle.findMany({
        where: { isActive: true, status: "AVAILABLE" },
        select: { id: true, assignedId: true, currentOdometer: true, make: { select: { name: true } }, model: { select: { name: true } } },
        orderBy: { assignedId: "asc" },
      }),
    ]);
    return { locations, companies, miscCharges, taxes, referrals, staff, vehicles };
  }),

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** "End Rental" — check the vehicle in. VERIFY field list against the live check-in screen. */
  end: staffProcedure
    .input(
      id.extend({
        checkedInAt: z.coerce.date(),
        checkInLocationId: z.string(),
        odometerIn: z.coerce.number().int().nonnegative(),
        fuelIn: z.coerce.number().int().min(0).max(16),
        checkInChannel: optStr,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const r = await loadRental(tx, input.rentalId);
        if (r.status !== "OPEN") throw new TRPCError({ code: "BAD_REQUEST", message: "Only open rentals can be ended." });
        if (input.odometerIn < r.odometerOut)
          throw new TRPCError({ code: "BAD_REQUEST", message: `Odometer in must be at least ${r.odometerOut}.` });
        await tx.rental.update({
          where: { id: r.id },
          data: {
            status: "CLOSED",
            checkedInAt: input.checkedInAt,
            checkInLocationId: input.checkInLocationId,
            odometerIn: input.odometerIn,
            fuelIn: input.fuelIn,
            checkInChannel: input.checkInChannel,
            closedById: ctx.user.id,
          },
        });
        await tx.rentalVehicleSegment.updateMany({
          where: { rentalId: r.id, endsAt: null },
          data: { endsAt: input.checkedInAt, odometerIn: input.odometerIn, fuelIn: input.fuelIn },
        });
        await tx.vehicleBlock.updateMany({ where: { rentalId: r.id }, data: { endsAt: input.checkedInAt } });
        await tx.vehicle.update({
          where: { id: r.vehicleId },
          data: { status: "AVAILABLE", currentOdometer: input.odometerIn, fuelLevel: input.fuelIn, currentLocationId: input.checkInLocationId },
        });
        if (r.reservationId) await tx.reservation.update({ where: { id: r.reservationId }, data: { status: "CHECKED_IN" } });
        await audit(tx, "Rental", r.id, ctx.user.id, {
          Status: [r.status, "CLOSED"],
          CheckinDate: [r.expectedReturnAt, input.checkedInAt],
          OdometerIn: [r.odometerIn, input.odometerIn],
        });
      }),
    ),

  reopen: staffProcedure.input(id).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await loadRental(tx, input.rentalId);
      if (r.status !== "CLOSED") throw new TRPCError({ code: "BAD_REQUEST", message: "Only closed rentals can be reopened." });
      await tx.rental.update({ where: { id: r.id }, data: { status: "OPEN", checkedInAt: null, closedById: null } });
      const last = await tx.rentalVehicleSegment.findFirst({ where: { rentalId: r.id }, orderBy: { sequence: "desc" } });
      if (last) await tx.rentalVehicleSegment.update({ where: { id: last.id }, data: { endsAt: null, odometerIn: null, fuelIn: null } });
      await tx.vehicleBlock.updateMany({ where: { rentalId: r.id }, data: { endsAt: r.expectedReturnAt } });
      await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "ON_RENT" } });
      await audit(tx, "Rental", r.id, ctx.user.id, { Status: [r.status, "OPEN"] });
    }),
  ),

  void: staffProcedure.input(id.extend({ reason: z.string().trim().min(3) })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await loadRental(tx, input.rentalId);
      if (r.status === "VOIDED") throw new TRPCError({ code: "BAD_REQUEST", message: "Rental is already void." });
      await tx.rental.update({ where: { id: r.id }, data: { status: "VOIDED", voidedAt: new Date() } });
      await tx.vehicleBlock.deleteMany({ where: { rentalId: r.id } });
      if (r.status === "OPEN") await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "AVAILABLE" } });
      await tx.memo.create({ data: { rentalId: r.id, authorId: ctx.user.id, body: `Voided: ${input.reason}` } });
      await audit(tx, "Rental", r.id, ctx.user.id, { Status: [r.status, "VOIDED"] });
    }),
  ),

  unvoid: staffProcedure.input(id).mutation(({ ctx, input }) =>
    withBookingGuard(() => ctx.prisma.$transaction(async (tx) => {
      const r = await loadRental(tx, input.rentalId);
      if (r.status !== "VOIDED") throw new TRPCError({ code: "BAD_REQUEST", message: "Rental is not void." });
      const next = r.checkedInAt ? "CLOSED" : "OPEN";
      if (next === "OPEN") {
        // re-reserve the vehicle; the exclusion constraint rejects it if the car is now booked elsewhere
        await tx.vehicleBlock.create({
          data: { vehicleId: r.vehicleId, rentalId: r.id, startsAt: r.checkOutAt, endsAt: r.expectedReturnAt },
        });
        await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "ON_RENT" } });
      }
      await tx.rental.update({ where: { id: r.id }, data: { status: next, voidedAt: null } });
      await audit(tx, "Rental", r.id, ctx.user.id, { Status: ["VOIDED", next] });
    })),
  ),

  /** Soft delete. Requires typing the RA number in the UI. */
  delete: staffProcedure.input(id.extend({ confirmRaNumber: z.coerce.number().int() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const r = await loadRental(tx, input.rentalId);
      if (r.raNumber !== input.confirmRaNumber)
        throw new TRPCError({ code: "BAD_REQUEST", message: "RA number doesn't match." });
      await tx.rental.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
      await tx.vehicleBlock.deleteMany({ where: { rentalId: r.id } });
      if (r.status === "OPEN") await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "AVAILABLE" } });
      await audit(tx, "Rental", r.id, ctx.user.id, { Deleted: [null, "yes"] });
    }),
  ),

  updateExchangeRate: staffProcedure
    .input(id.extend({ exchangeRate: z.coerce.number().positive() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const r = await loadRental(tx, input.rentalId);
        await tx.rental.update({ where: { id: r.id }, data: { exchangeRate: input.exchangeRate } });
        await audit(tx, "Rental", r.id, ctx.user.id, { ExchangeRate: [r.exchangeRate, input.exchangeRate] });
      }),
    ),

  // ── Sub-records ─────────────────────────────────────────────────────────────

  addPayment: staffProcedure
    .input(
      id.extend({
        method: z.enum(PAYMENT_METHODS),
        transactionType: z.enum(["PAYMENT", "AUTHORIZATION", "REFUND"]),
        amount: money.positive(),
        authorizationCode: optStr,
        transactionCode: optStr,
        cardLast4: z.string().regex(/^\d{4}$/).optional().or(z.literal("")).transform((v) => v || null),
        takenAt: z.coerce.date(),
        paymentDetail: optStr,
        paymentDetailCont: optStr,
        companyId: optStr,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const r = await loadRental(ctx.prisma, input.rentalId);
      const { rentalId, amount, ...rest } = input;
      await ctx.prisma.payment.create({
        data: { ...rest, rentalId, amount: D(amount), customerId: r.customerId, takenById: ctx.user.id },
      });
    }),

  addTrafficTicket: staffProcedure
    .input(
      id.extend({
        ticketDate: z.coerce.date(),
        offense: z.string().trim().min(1),
        location: optStr,
        amount: money.nonnegative(),
        officer: optStr,
        city: optStr,
        province: optStr,
        country: optStr,
        payMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
        isPaid: z.boolean().default(false),
        memo: optStr,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { rentalId, amount, ...rest } = input;
        await loadRental(tx, rentalId);
        await tx.trafficTicket.create({ data: { ...rest, rentalId, amount: D(amount) } });
        await syncTicketLine(tx, rentalId);
      }),
    ),

  removeTrafficTicket: staffProcedure.input(z.object({ ticketId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const t = await tx.trafficTicket.delete({ where: { id: input.ticketId } });
      await syncTicketLine(tx, t.rentalId);
    }),
  ),

  addAdjustment: staffProcedure
    .input(
      id.extend({
        kind: z.enum(CHARGE_KINDS),
        miscChargeId: optStr,
        name: z.string().trim().min(1),
        amount: money,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { rentalId, amount, ...rest } = input;
        await loadRental(tx, rentalId);
        await tx.adjustment.create({ data: { ...rest, rentalId, amount: D(amount), enteredById: ctx.user.id } });
        await tx.chargeLine.create({
          data: { rentalId, kind: input.kind, miscChargeId: input.miscChargeId, name: `Adjustment — ${input.name}`, units: D(1), rate: D(amount), total: D(amount), sortOrder: 6 },
        });
        await audit(tx, "Rental", rentalId, ctx.user.id, { [`Adjustment ${input.name}`]: [null, amount.toFixed(2)] });
      }),
    ),

  addCommission: staffProcedure
    .input(id.extend({ amount: money.positive(), referralId: optStr, userId: optStr }))
    .mutation(async ({ ctx, input }) => {
      if (!input.referralId && !input.userId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a referral or a staff member." });
      await loadRental(ctx.prisma, input.rentalId);
      await ctx.prisma.commission.create({
        data: { rentalId: input.rentalId, amount: D(input.amount), referralId: input.referralId, userId: input.userId, enteredById: ctx.user.id },
      });
    }),

  addBillSplit: staffProcedure.input(id.merge(billSplitInput)).mutation(async ({ ctx, input }) => {
    const { rentalId, ...rest } = input;
    await loadRental(ctx.prisma, rentalId);
    await ctx.prisma.billSplit.create({ data: { ...billSplitData(rest), rentalId } });
  }),

  removeBillSplit: staffProcedure.input(z.object({ billSplitId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.billSplit.delete({ where: { id: input.billSplitId } });
  }),

  addClaim: staffProcedure
    .input(
      id.extend({
        claimDate: z.coerce.date(),
        claimNumber: optStr,
        closeDate: optDate,
        type: z.enum(["RENTER", "THIRD_PARTY", "OTHER"]),
        location: optStr,
        policeDept: optStr,
        policeRep: optStr,
        status: z.enum(["OPEN", "PENDING", "CLOSED"]),
        deductible: money.nonnegative().optional().nullable(),
        totalPayments: money.nonnegative().optional().nullable(),
        memo: optStr,
        hasAccidentReport: z.boolean().default(false),
        hasRenterInsurancePolicy: z.boolean().default(false),
        hasPoliceReport: z.boolean().default(false),
        hasRentalAgreement: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { rentalId, deductible, totalPayments, ...rest } = input;
      await loadRental(ctx.prisma, rentalId);
      await ctx.prisma.claim.create({
        data: {
          ...rest,
          rentalId,
          deductible: deductible == null ? null : D(deductible),
          totalPayments: totalPayments == null ? null : D(totalPayments),
        },
      });
    }),

  addCreditInvoice: staffProcedure
    .input(id.extend({ beginDate: z.coerce.date(), endDate: z.coerce.date(), numberOfDays: z.coerce.number().int().nonnegative(), amount: money.positive() }))
    .mutation(async ({ ctx, input }) => {
      await loadRental(ctx.prisma, input.rentalId);
      await ctx.prisma.rentalInvoice.create({
        data: { rentalId: input.rentalId, beginDate: input.beginDate, endDate: input.endDate, numberOfDays: input.numberOfDays, amount: D(-Math.abs(input.amount)), isCredit: true },
      });
    }),

  addMemo: staffProcedure
    .input(id.extend({ kind: z.enum(["MEMO", "NOTE"]), body: z.string().trim().min(1).max(4000), showAsPopup: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await loadRental(ctx.prisma, input.rentalId);
      await ctx.prisma.memo.create({
        data: { rentalId: input.rentalId, kind: input.kind, body: input.body, showAsPopup: input.showAsPopup, authorId: ctx.user.id },
      });
    }),

  /** Find existing customers to attach as additional drivers. */
  searchDrivers: staffProcedure.input(z.object({ q: z.string().trim().min(2) })).query(({ ctx, input }) =>
    ctx.prisma.customer.findMany({
      where: {
        isActive: true,
        OR: [
          { lastName: { contains: input.q, mode: "insensitive" } },
          { firstName: { contains: input.q, mode: "insensitive" } },
          { licenseNumber: { contains: input.q, mode: "insensitive" } },
          { phone: { contains: input.q } },
        ],
      },
      take: 10,
      select: { id: true, firstName: true, lastName: true, licenseNumber: true, licenseExpiry: true, postal: true, isUndesired: true },
    }),
  ),

  addDriver: staffProcedure.input(id.extend({ customerId: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    if (c.isUndesired) throw new TRPCError({ code: "BAD_REQUEST", message: "This customer is on the undesired (do-not-rent) list." });
    await ctx.prisma.bookingDriver.create({ data: { rentalId: input.rentalId, customerId: input.customerId } });
  }),

  removeDriver: staffProcedure.input(z.object({ bookingDriverId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.bookingDriver.delete({ where: { id: input.bookingDriverId } });
  }),

  /** "Vehicle Exchange": close the current vehicle segment and start a new one on another car. */
  exchangeVehicle: staffProcedure
    .input(
      id.extend({
        at: z.coerce.date(),
        odometerInOld: z.coerce.number().int().nonnegative(),
        fuelInOld: z.coerce.number().int().min(0).max(16),
        newVehicleId: z.string(),
        odometerOutNew: z.coerce.number().int().nonnegative(),
        fuelOutNew: z.coerce.number().int().min(0).max(16),
      }),
    )
    .mutation(({ ctx, input }) =>
      withBookingGuard(() => ctx.prisma.$transaction(async (tx) => {
        const r = await loadRental(tx, input.rentalId);
        if (r.status !== "OPEN") throw new TRPCError({ code: "BAD_REQUEST", message: "Only open rentals can exchange vehicles." });
        const nv = await tx.vehicle.findUniqueOrThrow({ where: { id: input.newVehicleId } });
        const segments = await tx.rentalVehicleSegment.count({ where: { rentalId: r.id } });
        if (segments === 0)
          await tx.rentalVehicleSegment.create({
            data: { rentalId: r.id, vehicleId: r.vehicleId, startsAt: r.checkOutAt, odometerOut: r.odometerOut, fuelOut: r.fuelOut, sequence: 0 },
          });
        await tx.rentalVehicleSegment.updateMany({
          where: { rentalId: r.id, endsAt: null },
          data: { endsAt: input.at, odometerIn: input.odometerInOld, fuelIn: input.fuelInOld },
        });
        await tx.rentalVehicleSegment.create({
          data: { rentalId: r.id, vehicleId: nv.id, startsAt: input.at, odometerOut: input.odometerOutNew, fuelOut: input.fuelOutNew, sequence: segments + 1 },
        });
        // move the availability block: old car frees up from `at`, new car is blocked from `at`
        await tx.vehicleBlock.deleteMany({ where: { rentalId: r.id } });
        await tx.vehicleBlock.create({ data: { vehicleId: nv.id, rentalId: r.id, startsAt: input.at, endsAt: r.expectedReturnAt } });
        await tx.vehicle.update({ where: { id: r.vehicleId }, data: { status: "AVAILABLE", currentOdometer: input.odometerInOld, fuelLevel: input.fuelInOld } });
        await tx.vehicle.update({ where: { id: nv.id }, data: { status: "ON_RENT" } });
        await tx.rental.update({ where: { id: r.id }, data: { vehicleId: nv.id, vehicleTypeId: nv.vehicleTypeId } });
        await audit(tx, "Rental", r.id, ctx.user.id, { Vehicle: [r.vehicleId, nv.assignedId] });
      })),
    ),

  addTransport: staffProcedure.input(id.merge(transportInput)).mutation(async ({ ctx, input }) => {
    const { rentalId, ...rest } = input;
    await loadRental(ctx.prisma, rentalId);
    await ctx.prisma.transport.create({ data: { ...rest, rentalId } });
  }),
});
