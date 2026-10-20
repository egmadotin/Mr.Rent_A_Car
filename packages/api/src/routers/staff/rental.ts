import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted, requireDiscountAllowed, requirePermission } from "../../trpc";
import { audit } from "../../lib/audit";
import { rentalTotals } from "../../lib/totals";
import { withBookingGuard } from "../../lib/errors";
import { billSplitData, billSplitInput, transportInput } from "../../lib/bill-split";
import { priceBooking } from "../../lib/pricing";
import { bookingOptionsInput, staffPricingOptions } from "../../lib/booking-options";
import { methodData, paymentMethodInput } from "../../lib/payment-methods";
import { storedRateOverride } from "../../lib/rate-override";
import { syncDrivers } from "../../lib/booking-drivers";
import { customerInput, upsertBookingCustomer } from "../../lib/customer-input";

const D = (n: number) => new Prisma.Decimal(n);
const id = z.object({ rentalId: z.string() });
const money = z.coerce.number().finite();
const optStr = z.string().trim().max(500).optional().transform((v) => v || null);
const optDate = z.coerce.date().optional().nullable();

/** charge kinds priceBooking produces — Edit Rental replaces these and keeps the rest */
const REPRICED_KINDS = ["TIME", "MILEAGE", "UPGRADE", "DISCOUNT", "FUEL", "PROTECTION", "MISC", "OTHER", "ONE_WAY", "TAX"] as const;
const PAYMENT_METHODS = ["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"] as const;
const CHARGE_KINDS = [
  "TIME", "MILEAGE", "UPGRADE", "DISCOUNT", "FUEL", "PREPAID_FUEL", "MISC", "ONE_WAY", "DAMAGES",
  "TRAFFIC_TICKETS", "ADMIN", "OTHER",
] as const;

/** The Start a Rental / Edit Rental (CheckOut3.aspx) fields both endpoints share. */
const rentalFields = z.object({
  customer: customerInput,
  checkOutLocationId: z.string().min(1, "Pickup Location is required"),
  checkInLocationId: z.string().min(1, "Return Location is required"),
  checkOutAt: z.coerce.date({ invalid_type_error: "Pickup Date is required" }),
  returnAt: z.coerce.date({ invalid_type_error: "Return Date is required" }),
  vehicleTypeId: z.string().min(1, "Vehicle Type is required"),
  rateId: z.string().min(1, "Rate is required"),
  companyId: optStr,
  discountType: z.preprocess((v) => (v === "" ? null : v), z.enum(["PERCENT", "AMOUNT"]).nullable().optional()),
  discountValue: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
  discountReasonId: optStr,
  deposit: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
  isLongTerm: z.boolean().default(false),
  invoicingPeriod: optStr,
  odometerOut: z.coerce.number({ invalid_type_error: "Odometer Out is required" }).int().nonnegative(),
  fuelOut: z.coerce.number().int().min(0).max(16),
  prepaidFuel: z.boolean().default(false),
  referralId: optStr,
  claimNumber: optStr,
  airport: optStr,
  airline: optStr,
  flightNumber: optStr,
  poNumber: optStr,
  roNumber: optStr,
  rentalReasonId: optStr,
  openedById: optStr,
  memo: optStr,
  memoShowAsPopup: z.boolean().default(false),
  isNonRevenue: z.boolean().default(false),
  options: bookingOptionsInput,
  /** "Drivers / Add More Drivers" on the Customer tab; left out = unchanged */
  driverIds: z.array(z.string()).max(20).optional(),
});
const rentalReturnAfterPickup = (v: { checkOutAt: Date; returnAt: Date }, c: z.RefinementCtx) => {
  if (v.returnAt <= v.checkOutAt) c.addIssue({ code: "custom", path: ["returnAt"], message: "Return must be after pickup" });
};

/** Close an open rental: status, return details, vehicle back to Available, open segment / block ended, reservation Checked In. */
async function closeRental(
  tx: Prisma.TransactionClient,
  r: { id: string; status: string; vehicleId: string; reservationId: string | null; expectedReturnAt: Date; odometerIn: number | null },
  userId: string,
  v: { checkedInAt: Date; checkInLocationId: string; odometerIn: number; fuelIn: number; checkInChannel?: string | null },
) {
  await tx.rental.update({
    where: { id: r.id },
    data: {
      status: "CLOSED",
      checkedInAt: v.checkedInAt,
      checkInLocationId: v.checkInLocationId,
      odometerIn: v.odometerIn,
      fuelIn: v.fuelIn,
      checkInChannel: v.checkInChannel,
      closedById: userId,
    },
  });
  await tx.rentalVehicleSegment.updateMany({
    where: { rentalId: r.id, endsAt: null },
    data: { endsAt: v.checkedInAt, odometerIn: v.odometerIn, fuelIn: v.fuelIn },
  });
  await tx.vehicleBlock.updateMany({ where: { rentalId: r.id }, data: { endsAt: v.checkedInAt } });
  await tx.vehicle.update({
    where: { id: r.vehicleId },
    data: { status: "AVAILABLE", currentOdometer: v.odometerIn, fuelLevel: v.fuelIn, currentLocationId: v.checkInLocationId },
  });
  if (r.reservationId) await tx.reservation.update({ where: { id: r.reservationId }, data: { status: "CHECKED_IN" } });
  await audit(tx, "Rental", r.id, userId, {
    Status: [r.status, "CLOSED"],
    CheckinDate: [r.expectedReturnAt, v.checkedInAt],
    OdometerIn: [r.odometerIn, v.odometerIn],
  });
}

/** "10%" / "$25.00" — the discount as the Rental Discount report shows it; null when there is none. */
function discountText(type: string | null | undefined, value: Prisma.Decimal | number | null | undefined) {
  const n = value == null ? 0 : Number(value);
  if (!n) return null;
  return type === "PERCENT" ? `${n}%` : `$${n.toFixed(2)}`;
}

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

/** The charge line an adjustment created ("Adjustment — <name>", same kind and amount). */
async function adjustmentLine(tx: Prisma.TransactionClient, a: { rentalId: string; kind: string; name: string; amount: Prisma.Decimal }) {
  return tx.chargeLine.findFirst({ where: { rentalId: a.rentalId, kind: a.kind as never, name: `Adjustment — ${a.name}`, total: a.amount } });
}

export const rentalRouter = router({
  /**
   * AgreementsSearch.aspx ("Rent"): quick search (Rental # OR First Name OR Last Name) + Advanced Search
   * (Rental #, Reservation#, Pick-up / Return Date Begin–End, First/Last Name, Phone Number, Company/Corporate,
   * Exchanged, Vehicle ID, License Plate, Vehicle Make, Vehicle Type, Location Name, Loc. Out, Loc. In, Ticket Date,
   * Status, Credit Card #, Claim#, RO#, PO#, SSN, Rate Type, Invoice#). Sorted by pickup date.
   */
  list: permitted("Agreements")
    .input(
      z.object({
        status: z.enum(["OPEN", "CLOSED", "VOIDED"]).optional(),
        /** RentCentric status filter: Open | Pending | Close | Cancelled */
        legacyStatus: z.enum(["Open", "Pending", "Close", "Cancelled"]).optional(),
        search: z.string().optional(),
        raNumber: z.string().optional(),
        reservationNumber: z.string().optional(),
        pickupFrom: z.coerce.date().optional(),
        pickupTo: z.coerce.date().optional(),
        returnFrom: z.coerce.date().optional(),
        returnTo: z.coerce.date().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        companyId: z.string().optional(),
        exchanged: z.boolean().optional(),
        vehicleAssignedId: z.string().optional(),
        licensePlate: z.string().optional(),
        makeId: z.string().optional(),
        vehicleTypeId: z.string().optional(),
        locationId: z.string().optional(),
        checkOutLocationId: z.string().optional(),
        checkInLocationId: z.string().optional(),
        ticketDate: z.coerce.date().optional(),
        cardNumber: z.string().optional(),
        claimNumber: z.string().optional(),
        roNumber: z.string().optional(),
        poNumber: z.string().optional(),
        ssn: z.string().optional(),
        rateType: z.string().optional(),
        invoiceNumber: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const t = (v?: string) => v?.trim() || undefined;
      const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
      const int = (v?: string) => (t(v) && /^\d+$/.test(t(v)!) ? Number(t(v)) : undefined);
      const q = t(input.search);
      const asNumber = int(q);
      const STATUS: Record<string, Prisma.RentalWhereInput["status"]> = { Open: "OPEN", Close: "CLOSED", Cancelled: "VOIDED", Pending: { in: [] } };
      const dayRange = (d?: Date) => (d ? { gte: d, lt: new Date(+d + 86_400_000) } : undefined);
      const and: Prisma.RentalWhereInput[] = [
        ...(q ? [{ OR: [...(asNumber ? [{ raNumber: asNumber }] : []), { customer: { firstName: ci(q) } }, { customer: { lastName: ci(q) } }] }] : []),
        ...(int(input.raNumber) ? [{ raNumber: int(input.raNumber) }] : []),
        ...(int(input.reservationNumber) ? [{ reservation: { number: int(input.reservationNumber) } }] : []),
        ...(t(input.firstName) ? [{ customer: { firstName: ci(t(input.firstName)!) } }] : []),
        ...(t(input.lastName) ? [{ customer: { lastName: ci(t(input.lastName)!) } }] : []),
        ...(t(input.phone) ? [{ customer: { phone: { contains: t(input.phone)! } } }] : []),
        ...(t(input.ssn) ? [{ customer: { ssn: { contains: t(input.ssn)! } } }] : []),
        ...(input.exchanged ? [{ vehicleSegments: { some: { endsAt: { not: null } } } }] : []),
        ...(t(input.vehicleAssignedId) ? [{ vehicle: { assignedId: ci(t(input.vehicleAssignedId)!) } }] : []),
        ...(t(input.licensePlate) ? [{ vehicle: { licenseNumber: ci(t(input.licensePlate)!) } }] : []),
        ...(t(input.makeId) ? [{ vehicle: { makeId: t(input.makeId) } }] : []),
        ...(input.ticketDate ? [{ trafficTickets: { some: { ticketDate: dayRange(input.ticketDate) } } }] : []),
        ...(t(input.cardNumber) ? [{ payments: { some: { cardLast4: { contains: t(input.cardNumber)!.slice(-4) } } } }] : []),
        ...(t(input.claimNumber) ? [{ OR: [{ claimNumber: ci(t(input.claimNumber)!) }, { claims: { some: { claimNumber: ci(t(input.claimNumber)!) } } }] }] : []),
        ...(t(input.roNumber) ? [{ roNumber: ci(t(input.roNumber)!) }] : []),
        ...(t(input.poNumber) ? [{ poNumber: ci(t(input.poNumber)!) }] : []),
        ...(t(input.rateType) ? [{ rate: { rateType: t(input.rateType) } }] : []),
        ...(int(input.invoiceNumber) ? [{ invoices: { some: { invoiceNumber: int(input.invoiceNumber) } } }] : []),
        // "Location Name": the rental's own location (where it was opened)
        ...(t(input.locationId) ? [{ checkOutLocationId: t(input.locationId) }] : []),
      ];
      const where: Prisma.RentalWhereInput = {
        deletedAt: null,
        status: input.legacyStatus ? STATUS[input.legacyStatus] : input.status,
        companyId: t(input.companyId),
        vehicleTypeId: t(input.vehicleTypeId),
        checkInLocationId: t(input.checkInLocationId),
        ...(t(input.checkOutLocationId) ? { checkOutLocationId: t(input.checkOutLocationId) } : {}),
        checkOutAt: { gte: input.pickupFrom, lte: input.pickupTo },
        expectedReturnAt: { gte: input.returnFrom, lte: input.returnTo },
        AND: and,
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
            checkOutLocation: { select: { name: true, timeZone: true } },
            checkInLocation: { select: { name: true } },
          },
        }),
      ]);
      return { total, rows };
    }),

  byId: permitted("Agreements").input(id).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.rental.findFirst({
      where: { id: input.rentalId, deletedAt: null },
      include: {
        customer: true,
        company: { select: { id: true, name: true } },
        vehicle: { include: { make: true, model: true } },
        vehicleType: true,
        checkOutLocation: { select: { id: true, name: true, timeZone: true } },
        checkInLocation: { select: { id: true, name: true } },
        referral: { select: { name: true } },
        rentalReason: { select: { name: true } },
        rate: { select: { code: true } },
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
        reservation: { select: { id: true, number: true } },
        chargeLines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { tax: { select: { kind: true } }, miscCharge: { select: { calculationBy: true } } } },
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
    const [locations, companies, miscCharges, taxes, referrals, staff, vehicles, rentalReasons] = await Promise.all([
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
      ctx.prisma.lookup.findMany({ where: { kind: "RENTAL_REASON", isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    ]);
    return { locations, companies, miscCharges, taxes, referrals, staff, vehicles, rentalReasons };
  }),

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** "End Rental" — check the vehicle in. VERIFY field list against the live check-in screen. */
  end: permitted("CheckIns")
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
        await closeRental(tx, r, ctx.user.id, input);
      }),
    ),

  reopen: permitted("chkAllowReOpenRentals").input(id).mutation(({ ctx, input }) =>
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

  void: permitted("AgreementsCancel").input(id.extend({ reason: z.string().trim().min(3) })).mutation(({ ctx, input }) =>
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

  unvoid: permitted("chkAllowUnVoidRentals").input(id).mutation(({ ctx, input }) =>
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
  delete: permitted("AgreementsDelete").input(id.extend({ confirmRaNumber: z.coerce.number().int() })).mutation(({ ctx, input }) =>
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

  /**
   * Start a Rental (CheckOut3.aspx?DoAction=New): a walk-in rental without a reservation. The renter is always saved as a
   * customer (the form requires licence details); charges come from the same options grid as quotes / reservations.
   */
  startWalkIn: permitted("CheckOuts")
    .input(
      rentalFields
        .extend({
          customerId: optStr,
          allowUndesired: z.boolean().default(false),
          vehicleId: z.string().min(1, "Vehicle ID is required"),
          payment: z
            .object({
              method: paymentMethodInput,
              transactionType: z.enum(["PAYMENT", "AUTHORIZATION", "REFUND"]),
              amount: z.coerce.number().positive("Amount must be more than 0"),
              authorizationCode: optStr,
              transactionCode: optStr,
            })
            .nullable()
            .optional(),
        })
        .superRefine(rentalReturnAfterPickup),
    )
    .mutation(({ ctx, input }) =>
      withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          await requireDiscountAllowed(ctx, input.discountType, input.discountValue);
          if (input.companyId && !input.allowUndesired) {
            const co = await tx.company.findUnique({ where: { id: input.companyId } });
            if (co?.isUndesired) throw new TRPCError({ code: "CONFLICT", message: "UNDESIRED_COMPANY" });
          }
          const v = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } });
          if (v.vehicleTypeId !== input.vehicleTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "The vehicle is a different type from the rental's vehicle type." });
          const customerId = (await upsertBookingCustomer(tx, {
            customerId: input.customerId,
            customer: input.customer,
            save: true,
            allowUndesired: input.allowUndesired,
            locationId: input.checkOutLocationId,
          }))!;
          const priced = await priceBooking(tx, {
            pickupAt: input.checkOutAt,
            returnAt: input.returnAt,
            locationId: input.checkOutLocationId,
            returnLocationId: input.checkInLocationId,
            vehicleTypeId: input.vehicleTypeId,
            rateId: input.rateId,
            discountType: input.discountType,
            discountValue: input.discountValue,
            ...staffPricingOptions(input.options),
          });
          const rental = await tx.rental.create({
            data: {
              customerId,
              companyId: input.companyId,
              checkOutLocationId: input.checkOutLocationId,
              checkInLocationId: input.checkInLocationId,
              checkOutAt: input.checkOutAt,
              expectedReturnAt: input.returnAt,
              checkOutChannel: "Counter",
              vehicleTypeId: v.vehicleTypeId,
              vehicleId: v.id,
              odometerOut: input.odometerOut,
              fuelOut: input.fuelOut,
              prepaidFuel: input.prepaidFuel,
              rateId: input.rateId,
              rateOverride: storedRateOverride(input.options.rateOverride),
              discountType: input.discountValue ? input.discountType ?? null : null,
              discountValue: input.discountValue ? D(input.discountValue) : null,
              discountReasonId: input.discountReasonId,
              deposit: input.deposit == null ? null : D(input.deposit),
              isLongTerm: input.isLongTerm,
              invoicingPeriod: input.invoicingPeriod,
              referralId: input.referralId,
              rentalReasonId: input.rentalReasonId,
              claimNumber: input.claimNumber,
              airport: input.airport,
              airline: input.airline,
              flightNumber: input.flightNumber,
              poNumber: input.poNumber,
              roNumber: input.roNumber,
              isNonRevenue: input.isNonRevenue,
              excludedTaxIds: input.options.excludedTaxIds,
              openedById: input.openedById ?? ctx.user.id,
              chargeLines: { create: priced.lines },
              vehicleSegments: { create: [{ vehicleId: v.id, startsAt: input.checkOutAt, odometerOut: input.odometerOut, fuelOut: input.fuelOut }] },
            },
          });
          await tx.vehicleBlock.create({ data: { vehicleId: v.id, rentalId: rental.id, startsAt: input.checkOutAt, endsAt: input.returnAt } });
          if (input.driverIds) await syncDrivers(tx, { rentalId: rental.id }, customerId, input.driverIds);
          await tx.vehicle.update({ where: { id: v.id }, data: { status: "ON_RENT", currentOdometer: input.odometerOut, fuelLevel: input.fuelOut } });
          if (input.memo) await tx.memo.create({ data: { rentalId: rental.id, body: input.memo, showAsPopup: input.memoShowAsPopup, authorId: ctx.user.id } });
          if (input.payment)
            await tx.payment.create({ data: { ...input.payment, ...methodData(input.payment.method), amount: D(input.payment.amount), rentalId: rental.id, customerId, takenById: ctx.user.id } });
          await audit(tx, "Rental", rental.id, ctx.user.id, { RANumber: ["Start Rental", rental.raNumber] });
          if (input.discountValue) await audit(tx, "Rental", rental.id, ctx.user.id, { Discount: [null, discountText(input.discountType, input.discountValue)] });
          return { rentalId: rental.id };
        }),
      ),
    ),

  /**
   * Edit Rental (Checkout3.aspx?AgreementID=…): the same form with Expected Return, Return Date / Odometer In / Fuel In
   * (closed rentals), Fuel Charge and Upgrade Type / Amount. Re-prices the rental; traffic tickets, admin charges,
   * damages, prepaid fuel and adjustments stay as they are. The vehicle itself changes through Vehicle Exchange.
   */
  update: permitted("AgreementsEdit")
    .input(
      rentalFields
        .extend({
          rentalId: z.string(),
          allowUndesired: z.boolean().default(false),
          checkedInAt: z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional()),
          odometerIn: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nonnegative().nullable()),
          fuelIn: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(16).nullable()),
          fuelCharge: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
          upgradeType: z.preprocess((v) => (v === "" ? null : v), z.enum(["FLAT", "DAILY"]).nullable().optional()),
          upgradeAmount: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
          /** End Rental: save and close the open rental */
          close: z.boolean().default(false),
        })
        .superRefine(rentalReturnAfterPickup),
    )
    .mutation(({ ctx, input }) =>
      withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          const r = await loadRental(tx, input.rentalId);
          if (input.close) await requirePermission(ctx, "CheckIns");
          if (r.status === "CLOSED") await requirePermission(ctx, "ClosedAgreementsEdit");
          if (input.discountValue !== (r.discountValue == null ? null : Number(r.discountValue))) await requireDiscountAllowed(ctx, input.discountType, input.discountValue);
          if (input.companyId && input.companyId !== r.companyId && !input.allowUndesired) {
            const co = await tx.company.findUnique({ where: { id: input.companyId } });
            if (co?.isUndesired) throw new TRPCError({ code: "CONFLICT", message: "UNDESIRED_COMPANY" });
          }
          if (input.close) {
            if (r.status !== "OPEN") throw new TRPCError({ code: "BAD_REQUEST", message: "Only open rentals can be ended." });
            const missing = [!input.checkedInAt && "Return Date", input.odometerIn == null && "Odometer In", input.fuelIn == null && "Fuel In"].filter(Boolean);
            if (missing.length) throw new TRPCError({ code: "BAD_REQUEST", message: `${missing.join(", ")} required to end the rental.` });
          }
          const closed = r.status === "CLOSED" || input.close;
          if (closed && input.odometerIn != null && input.odometerIn < input.odometerOut)
            throw new TRPCError({ code: "BAD_REQUEST", message: `Odometer In must be at least ${input.odometerOut}.` });
          await upsertBookingCustomer(tx, {
            customerId: r.customerId,
            customer: input.customer,
            save: true,
            allowUndesired: true,
            locationId: input.checkOutLocationId,
          });
          const checkedInAt = closed ? input.checkedInAt ?? r.checkedInAt : null;
          const endsAt = checkedInAt ?? input.returnAt;
          const priced = await priceBooking(tx, {
            pickupAt: input.checkOutAt,
            returnAt: endsAt,
            locationId: input.checkOutLocationId,
            returnLocationId: input.checkInLocationId,
            vehicleTypeId: input.vehicleTypeId,
            rateId: input.rateId,
            discountType: input.discountType,
            discountValue: input.discountValue,
            upgrade: input.upgradeType && input.upgradeAmount ? { type: input.upgradeType, amount: input.upgradeAmount } : null,
            fuelCharge: input.fuelCharge,
            ...staffPricingOptions(input.options),
          });
          await tx.rental.update({
            where: { id: r.id },
            data: {
              companyId: input.companyId,
              checkOutLocationId: input.checkOutLocationId,
              checkInLocationId: input.checkInLocationId,
              checkOutAt: input.checkOutAt,
              expectedReturnAt: input.returnAt,
              ...(closed ? { checkedInAt, odometerIn: input.odometerIn, fuelIn: input.fuelIn } : {}),
              vehicleTypeId: input.vehicleTypeId,
              odometerOut: input.odometerOut,
              fuelOut: input.fuelOut,
              prepaidFuel: input.prepaidFuel,
              rateId: input.rateId,
              rateOverride: storedRateOverride(input.options.rateOverride),
              discountType: input.discountValue ? input.discountType ?? null : null,
              discountValue: input.discountValue ? D(input.discountValue) : null,
              discountReasonId: input.discountReasonId,
              isLongTerm: input.isLongTerm,
              invoicingPeriod: input.invoicingPeriod,
              referralId: input.referralId,
              rentalReasonId: input.rentalReasonId,
              claimNumber: input.claimNumber,
              airport: input.airport,
              airline: input.airline,
              flightNumber: input.flightNumber,
              poNumber: input.poNumber,
              roNumber: input.roNumber,
              isNonRevenue: input.isNonRevenue,
              excludedTaxIds: input.options.excludedTaxIds,
              openedById: input.openedById,
            },
          });
          if (input.driverIds) await syncDrivers(tx, { rentalId: r.id }, r.customerId, input.driverIds);
          // the Rental Discount report reads these rows
          await audit(tx, "Rental", r.id, ctx.user.id, { Discount: [discountText(r.discountType, r.discountValue), discountText(input.discountType, input.discountValue)] });
          // re-priced lines replace the old ones; lines entered elsewhere on the rental stay
          await tx.chargeLine.deleteMany({
            where: { rentalId: r.id, kind: { in: [...REPRICED_KINDS] }, NOT: { name: { startsWith: "Adjustment — " } } },
          });
          await tx.chargeLine.createMany({ data: priced.lines.map((l) => ({ ...l, rentalId: r.id })) });
          const first = await tx.rentalVehicleSegment.findFirst({ where: { rentalId: r.id }, orderBy: [{ sequence: "asc" }, { startsAt: "asc" }] });
          if (first) await tx.rentalVehicleSegment.update({ where: { id: first.id }, data: { startsAt: input.checkOutAt, odometerOut: input.odometerOut, fuelOut: input.fuelOut } });
          await tx.vehicleBlock.updateMany({ where: { rentalId: r.id }, data: { startsAt: input.checkOutAt, endsAt } });
          const latest = await tx.memo.findFirst({ where: { rentalId: r.id, kind: "MEMO" }, orderBy: { createdAt: "desc" } });
          if (input.memo && input.memo !== latest?.body)
            await tx.memo.create({ data: { rentalId: r.id, body: input.memo, showAsPopup: input.memoShowAsPopup, authorId: ctx.user.id } });
          await audit(tx, "Rental", r.id, ctx.user.id, {
            CheckoutDate: [r.checkOutAt, input.checkOutAt],
            ExpectedCheckinDate: [r.expectedReturnAt, input.returnAt],
            CheckinDate: [r.checkedInAt, checkedInAt],
            OdometerOut: [r.odometerOut, input.odometerOut],
            OdometerIn: [r.odometerIn, closed ? input.odometerIn : r.odometerIn],
            VehicleType: [r.vehicleTypeId, input.vehicleTypeId],
            Rate: [r.rateId, input.rateId],
          });
          if (input.close)
            await closeRental(tx, r, ctx.user.id, {
              checkedInAt: checkedInAt!,
              checkInLocationId: input.checkInLocationId,
              odometerIn: input.odometerIn!,
              fuelIn: input.fuelIn!,
              checkInChannel: "Counter",
            });
          return { rentalId: r.id };
        }),
      ),
    ),

  addPayment: staffProcedure
    .input(
      id.extend({
        method: paymentMethodInput,
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
      if (input.transactionType === "REFUND") await requirePermission(ctx, "Transactions");
      const r = await loadRental(ctx.prisma, input.rentalId);
      const { rentalId, amount, ...rest } = input;
      await ctx.prisma.payment.create({
        data: { ...rest, ...methodData(input.method), rentalId, amount: D(amount), customerId: r.customerId, takenById: ctx.user.id },
      });
    }),

  /** Edit a payment (rental or reservation) — RentCentric "Edit Transactions". */
  updatePayment: permitted("TransactionsEdit")
    .input(
      z.object({
        paymentId: z.string(),
        method: paymentMethodInput,
        transactionType: z.enum(["PAYMENT", "AUTHORIZATION", "REFUND"]),
        amount: money.positive(),
        authorizationCode: optStr,
        transactionCode: optStr,
        takenAt: z.coerce.date(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { paymentId, amount, ...rest } = input;
        const before = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
        if (input.transactionType === "REFUND" && before.transactionType !== "REFUND") await requirePermission(ctx, "Transactions");
        if (before.rentalId) await loadRental(tx, before.rentalId);
        await tx.payment.update({ where: { id: paymentId }, data: { ...rest, ...methodData(input.method), amount: D(amount) } });
        await audit(tx, before.rentalId ? "Rental" : "Reservation", (before.rentalId ?? before.reservationId)!, ctx.user.id, {
          [`Payment ${before.method} ${before.transactionType}`]: [before.amount.toFixed(2), `${input.method} ${input.transactionType} ${amount.toFixed(2)}`],
        });
      }),
    ),
  /** Delete a payment (rental or reservation) — RentCentric "Delete Transactions". */
  deletePayment: permitted("TransactionsDelete").input(z.object({ paymentId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found" });
      if (p.rentalId) await loadRental(tx, p.rentalId);
      await tx.payment.delete({ where: { id: p.id } });
      await audit(tx, p.rentalId ? "Rental" : "Reservation", (p.rentalId ?? p.reservationId)!, ctx.user.id, {
        [`Payment ${p.method} ${p.transactionType}`]: [p.amount.toFixed(2), "deleted"],
      });
    }),
  ),

  addTrafficTicket: permitted("TrafficTicketsAdd")
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

  removeTrafficTicket: permitted("TrafficTicketsDelete").input(z.object({ ticketId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const t = await tx.trafficTicket.delete({ where: { id: input.ticketId } });
      await syncTicketLine(tx, t.rentalId);
    }),
  ),

  addAdjustment: permitted("CKAllowAdjustments")
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

  /** Edit an adjustment and its "Adjustment — …" charge line. */
  updateAdjustment: permitted("CKAllowAdjustments")
    .input(z.object({ adjustmentId: z.string(), name: z.string().trim().min(1), amount: money }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const a = await tx.adjustment.findUnique({ where: { id: input.adjustmentId } });
        if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Adjustment not found" });
        await loadRental(tx, a.rentalId);
        const line = await adjustmentLine(tx, a);
        await tx.adjustment.update({ where: { id: a.id }, data: { name: input.name, amount: D(input.amount) } });
        const data = { name: `Adjustment — ${input.name}`, rate: D(input.amount), total: D(input.amount) };
        if (line) await tx.chargeLine.update({ where: { id: line.id }, data });
        else await tx.chargeLine.create({ data: { ...data, rentalId: a.rentalId, kind: a.kind, miscChargeId: a.miscChargeId, units: D(1), sortOrder: 6 } });
        await audit(tx, "Rental", a.rentalId, ctx.user.id, { [`Adjustment ${a.name}`]: [a.amount.toFixed(2), `${input.name} ${input.amount.toFixed(2)}`] });
      }),
    ),
  deleteAdjustment: permitted("CKAllowAdjustments").input(z.object({ adjustmentId: z.string() })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const a = await tx.adjustment.findUnique({ where: { id: input.adjustmentId } });
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Adjustment not found" });
      await loadRental(tx, a.rentalId);
      const line = await adjustmentLine(tx, a);
      if (line) await tx.chargeLine.delete({ where: { id: line.id } });
      await tx.adjustment.delete({ where: { id: a.id } });
      await audit(tx, "Rental", a.rentalId, ctx.user.id, { [`Adjustment ${a.name}`]: [a.amount.toFixed(2), "deleted"] });
    }),
  ),

  updateCommission: permitted("CommissionsEdit")
    .input(z.object({ commissionId: z.string(), amount: money.positive(), referralId: optStr, userId: optStr }))
    .mutation(async ({ ctx, input }) => {
      if (!input.referralId && !input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a referral or a staff member." });
      const c = await ctx.prisma.commission.findUnique({ where: { id: input.commissionId } });
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Commission not found" });
      await loadRental(ctx.prisma, c.rentalId);
      await ctx.prisma.commission.update({ where: { id: c.id }, data: { amount: D(input.amount), referralId: input.referralId, userId: input.userId } });
    }),
  deleteCommission: permitted("CommissionsDelete").input(z.object({ commissionId: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.prisma.commission.findUnique({ where: { id: input.commissionId } });
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Commission not found" });
    await loadRental(ctx.prisma, c.rentalId);
    await ctx.prisma.commission.delete({ where: { id: c.id } });
  }),

  addCommission: permitted("CommissionsAdd")
    .input(id.extend({ amount: money.positive(), referralId: optStr, userId: optStr }))
    .mutation(async ({ ctx, input }) => {
      if (!input.referralId && !input.userId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a referral or a staff member." });
      await loadRental(ctx.prisma, input.rentalId);
      await ctx.prisma.commission.create({
        data: { rentalId: input.rentalId, amount: D(input.amount), referralId: input.referralId, userId: input.userId, enteredById: ctx.user.id },
      });
    }),

  addBillSplit: permitted("BillSplitAdd").input(id.merge(billSplitInput)).mutation(async ({ ctx, input }) => {
    const { rentalId, ...rest } = input;
    await loadRental(ctx.prisma, rentalId);
    await ctx.prisma.billSplit.create({ data: { ...billSplitData(rest), rentalId } });
  }),

  removeBillSplit: permitted("BillSplitDelete").input(z.object({ billSplitId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.billSplit.delete({ where: { id: input.billSplitId } });
  }),

  addClaim: permitted("ClaimsAdd")
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
      const r = await loadRental(ctx.prisma, rentalId);
      await ctx.prisma.claim.create({
        data: {
          ...rest,
          rentalId,
          vehicleId: r.vehicleId,
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
      if (input.kind === "NOTE") await requirePermission(ctx, "AddNotesCheckbox");
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
