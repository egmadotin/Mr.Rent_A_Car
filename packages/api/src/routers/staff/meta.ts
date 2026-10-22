import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure } from "../../trpc";
import { startOfDayIn } from "../../lib/tz";

/** Pick-lists and shell data used across ERP screens. */
const opt = z.string().trim().max(1000).optional().transform((v) => v || null);

export const metaRouter = router({
  /** ReferralsQuickAdd.aspx (the ⊕ next to Referral on the booking forms). */
  referralQuickAdd: staffProcedure
    .input(
      z.object({
        name: z.string({ required_error: "Referral/Company Name is required" }).trim().min(1, "Referral/Company Name is required").max(200),
        fullName: opt,
        email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || null),
        phone: opt,
        fax: opt,
        memo: opt,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const r = await ctx.prisma.referral.create({ data: input, select: { id: true, name: true } });
        return r;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new TRPCError({ code: "CONFLICT", message: "A referral with this name already exists." });
        throw e;
      }
    }),


  activeLocations: staffProcedure.query(({ ctx }) =>
    ctx.prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isOffsite: true, timeZone: true },
    }),
  ),

  /** Header counters (legacy status bar: In-Fleet, Available, On Rent, Leaving/Returning today, Overdue …). */
  fleetStatus: staffProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfDay = startOfDayIn(now);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const tomorrowEnd = new Date(endOfDay.getTime() + 86_400_000);

    const [inFleet, available, onRent, leavingToday, returningToday, overdue, rentedToday, rezTomorrow, noShow] =
      await Promise.all([
        ctx.prisma.vehicle.count({ where: { isActive: true } }),
        ctx.prisma.vehicle.count({ where: { isActive: true, status: "AVAILABLE" } }),
        ctx.prisma.rental.count({ where: { status: "OPEN", deletedAt: null } }),
        ctx.prisma.reservation.count({
          where: { status: { in: ["TENTATIVE", "CONFIRMED"] }, pickupAt: { gte: startOfDay, lt: endOfDay }, deletedAt: null },
        }),
        ctx.prisma.rental.count({
          where: { status: "OPEN", expectedReturnAt: { gte: startOfDay, lt: endOfDay }, deletedAt: null },
        }),
        ctx.prisma.rental.count({ where: { status: "OPEN", expectedReturnAt: { lt: now }, deletedAt: null } }),
        ctx.prisma.rental.count({ where: { checkOutAt: { gte: startOfDay, lt: endOfDay }, deletedAt: null } }),
        ctx.prisma.reservation.count({
          where: { status: { in: ["TENTATIVE", "CONFIRMED"] }, pickupAt: { gte: endOfDay, lt: tomorrowEnd }, deletedAt: null },
        }),
        ctx.prisma.reservation.count({ where: { status: "NO_SHOW", deletedAt: null } }),
      ]);
    return { inFleet, available, onRent, leavingToday, returningToday, overdue, rentedToday, rezTomorrow, noShow };
  }),

  /**
   * Dashboard (RentCentric Home3.aspx): Rentals Leaving Today, Returning Today and the
   * Rental Graph View (share of the fleet booked each day for the next 7 / 14 / 30 days).
   */
  dashboard: staffProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7) })).query(async ({ ctx, input }) => {
    const now = new Date();
    const today = startOfDayIn(now);
    const tomorrow = new Date(+today + 86_400_000);
    const active = ["TENTATIVE", "CONFIRMED"] as const;
    const [leaving, returning, inFleet, rentals, reservations] = await Promise.all([
      ctx.prisma.reservation.findMany({
        where: { status: { in: [...active] }, pickupAt: { gte: today, lt: tomorrow }, deletedAt: null },
        orderBy: { pickupAt: "asc" },
        take: 50,
        select: { id: true, number: true, pickupAt: true, firstName: true, lastName: true, customer: { select: { firstName: true, lastName: true } }, vehicleType: { select: { name: true } }, pickupLocation: { select: { name: true } } },
      }),
      ctx.prisma.rental.findMany({
        where: { status: "OPEN", expectedReturnAt: { lt: tomorrow }, deletedAt: null },
        orderBy: { expectedReturnAt: "asc" },
        take: 50,
        select: { id: true, raNumber: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } }, checkInLocation: { select: { name: true } } },
      }),
      ctx.prisma.vehicle.count({ where: { isActive: true } }),
      ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: { in: ["OPEN", "CLOSED"] }, checkOutAt: { lt: new Date(+today + input.days * 86_400_000) }, OR: [{ checkedInAt: null }, { checkedInAt: { gt: today } }] },
        select: { checkOutAt: true, checkedInAt: true, expectedReturnAt: true },
      }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null, status: { in: [...active] }, pickupAt: { lt: new Date(+today + input.days * 86_400_000) }, returnAt: { gt: today } },
        select: { pickupAt: true, returnAt: true },
      }),
    ]);

    const graph = Array.from({ length: input.days }, (_, i) => {
      const from = new Date(+today + i * 86_400_000);
      const to = new Date(+from + 86_400_000);
      const busy =
        rentals.filter((r) => r.checkOutAt < to && (r.checkedInAt ?? r.expectedReturnAt) > from).length +
        reservations.filter((r) => r.pickupAt < to && r.returnAt > from).length;
      return { date: from, booked: busy, percent: inFleet ? Math.min(100, Math.round((busy / inFleet) * 100)) : 0 };
    });

    const name = (r: { firstName: string | null; lastName: string | null; customer: { firstName: string; lastName: string } | null }) =>
      r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : [r.firstName, r.lastName].filter(Boolean).join(" ");
    return {
      leaving: leaving.map((r) => ({ id: r.id, number: r.number, at: r.pickupAt, name: name(r), vehicleType: r.vehicleType.name, location: r.pickupLocation.name })),
      returning: returning.map((r) => ({ id: r.id, raNumber: r.raNumber, at: r.expectedReturnAt, overdue: r.expectedReturnAt < now, name: `${r.customer.firstName} ${r.customer.lastName}`, vehicle: `${r.vehicle.assignedId} · ${r.vehicle.make.name} ${r.vehicle.model.name}`, location: r.checkInLocation.name })),
      graph,
    };
  }),

  /**
   * Dashboard insights: revenue (booked by pick-up day) for the last 30 days and month to date vs the same days last
   * month, collected payments, average daily rate and rental length, money still owed, the fleet by status and by
   * vehicle type, the next 30 days' reservations, per-location load and the latest bookings.
   */
  insights: staffProcedure.query(async ({ ctx }) => {
    const DAY = 86_400_000;
    const now = new Date();
    const today = startOfDayIn(now);
    const from30 = new Date(+today - 29 * DAY);
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const y = Number(p.find((x) => x.type === "year")!.value), mo = Number(p.find((x) => x.type === "month")!.value), dd = Number(p.find((x) => x.type === "day")!.value);
    const monthStart = new Date(+today - (dd - 1) * DAY);
    const prevMonthDays = new Date(y, mo - 1, 0).getDate();
    const prevStart = new Date(+monthStart - prevMonthDays * DAY);
    const prevSameDay = new Date(+prevStart + Math.min(dd, prevMonthDays) * DAY);
    const next30 = new Date(+today + 30 * DAY);
    const yearAgo = new Date(+today - 365 * DAY);
    const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));
    const round = (n: number) => Math.round(n * 100) / 100;

    const [booked, payments, owing, fleet, types, upcoming, quotes, locations, recentRes, recentRentals] = await Promise.all([
      ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: { in: ["OPEN", "CLOSED"] }, checkOutAt: { gte: prevStart < from30 ? prevStart : from30, lt: new Date(+today + DAY) } },
        select: { checkOutAt: true, vehicleTypeId: true, chargeLines: { select: { kind: true, name: true, units: true, total: true } } },
      }),
      ctx.prisma.payment.findMany({ where: { takenAt: { gte: monthStart }, transactionType: { in: ["PAYMENT", "REFUND"] } }, select: { amount: true, transactionType: true } }),
      ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: { in: ["OPEN", "CLOSED"] }, checkOutAt: { gte: yearAgo } },
        select: { status: true, chargeLines: { select: { total: true } }, payments: { select: { amount: true, transactionType: true } }, billSplits: { select: { prePaid: true } } },
      }),
      ctx.prisma.vehicle.groupBy({ by: ["status"], where: { isActive: true }, _count: true }),
      ctx.prisma.vehicleType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, vehicles: { where: { isActive: true }, select: { status: true } } },
      }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null, status: { in: ["TENTATIVE", "CONFIRMED"] }, pickupAt: { gte: today, lt: next30 } },
        select: { status: true, pickupAt: true, createdById: true },
      }),
      ctx.prisma.quote.count({ where: { createdAt: { gte: from30 } } }),
      ctx.prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true,
          _count: { select: { vehiclesRental: { where: { isActive: true } } } },
          vehiclesRental: { where: { isActive: true, status: "ON_RENT" }, select: { id: true } },
          reservationsPickup: { where: { deletedAt: null, status: { in: ["TENTATIVE", "CONFIRMED"] }, pickupAt: { gte: today, lt: new Date(+today + 7 * DAY) } }, select: { id: true } },
        },
      }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6,
        select: { id: true, number: true, createdAt: true, status: true, createdById: true, firstName: true, lastName: true, customer: { select: { firstName: true, lastName: true } }, vehicleType: { select: { name: true } } },
      }),
      ctx.prisma.rental.findMany({
        where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6,
        select: { id: true, raNumber: true, createdAt: true, status: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { assignedId: true } } },
      }),
    ]);

    const revenueOf = (r: (typeof booked)[number]) => r.chargeLines.filter((l) => l.kind !== "TAX").reduce((a, l) => a + num(l.total), 0);
    const daysOf = (r: (typeof booked)[number]) =>
      r.chargeLines.filter((l) => l.kind === "TIME").reduce((a, l) => a + num(l.units) * (/week/i.test(l.name) ? 7 : /month/i.test(l.name) ? 30 : /dai|day/i.test(l.name) ? 1 : 0), 0);
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(+from30 + i * DAY);
      const rs = booked.filter((r) => +r.checkOutAt >= +d && +r.checkOutAt < +d + DAY);
      return { date: d, revenue: round(rs.reduce((a, r) => a + revenueOf(r), 0)), rentals: rs.length };
    });
    const mtd = booked.filter((r) => r.checkOutAt >= monthStart);
    const prev = booked.filter((r) => r.checkOutAt >= prevStart && r.checkOutAt < prevSameDay);
    const mtdRevenue = round(mtd.reduce((a, r) => a + revenueOf(r), 0));
    const prevRevenue = round(prev.reduce((a, r) => a + revenueOf(r), 0));
    const timeRevenue = mtd.reduce((a, r) => a + r.chargeLines.filter((l) => l.kind === "TIME").reduce((b, l) => b + num(l.total), 0), 0);
    const rentalDays = mtd.reduce((a, r) => a + daysOf(r), 0);
    const collected = round(payments.reduce((a, x) => a + (x.transactionType === "PAYMENT" ? num(x.amount) : -num(x.amount)), 0));
    let owed = 0, owedCount = 0;
    for (const r of owing) {
      const bal = r.chargeLines.reduce((a, l) => a + num(l.total), 0) - r.payments.reduce((a, x) => a + (x.transactionType === "PAYMENT" ? num(x.amount) : x.transactionType === "REFUND" ? -num(x.amount) : 0), 0) - r.billSplits.reduce((a, b) => a + num(b.prePaid), 0);
      if (bal > 0.005) { owed += bal; owedCount++; }
    }
    const typeRevenue = new Map<string, number>();
    for (const r of mtd) typeRevenue.set(r.vehicleTypeId, (typeRevenue.get(r.vehicleTypeId) ?? 0) + revenueOf(r));
    const name = (r: { firstName?: string | null; lastName?: string | null; customer: { firstName: string; lastName: string } | null }) =>
      r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : [r.firstName, r.lastName].filter(Boolean).join(" ");

    return {
      revenue: {
        daily, mtd: mtdRevenue, prevSamePeriod: prevRevenue, change: prevRevenue ? round(((mtdRevenue - prevRevenue) / prevRevenue) * 100) : null,
        rentalsMtd: mtd.length, collected, avgDailyRate: rentalDays ? round(timeRevenue / rentalDays) : 0, avgLength: mtd.length ? round(rentalDays / mtd.length) : 0,
      },
      owed: { amount: round(owed), count: owedCount },
      fleetByStatus: fleet.map((f) => ({ status: f.status, count: f._count })).sort((a, b) => b.count - a.count),
      byType: types
        .map((t) => ({ name: t.name, fleet: t.vehicles.length, onRent: t.vehicles.filter((v) => v.status === "ON_RENT").length, revenue: round(typeRevenue.get(t.id) ?? 0) }))
        .filter((t) => t.fleet || t.revenue)
        .sort((a, b) => b.revenue - a.revenue || b.fleet - a.fleet),
      pipeline: {
        next7: upcoming.filter((r) => +r.pickupAt < +today + 7 * DAY).length, next30: upcoming.length,
        confirmed: upcoming.filter((r) => r.status === "CONFIRMED").length, tentative: upcoming.filter((r) => r.status === "TENTATIVE").length,
        online: upcoming.filter((r) => !r.createdById).length, quotes30: quotes,
      },
      locations: locations.map((l) => ({ id: l.id, name: l.name, fleet: l._count.vehiclesRental, onRent: l.vehiclesRental.length, pickups7: l.reservationsPickup.length })),
      recent: [
        ...recentRes.map((r) => ({ kind: "RESERVATION" as const, id: r.id, number: r.number, at: r.createdAt, status: r.status, name: name(r), detail: r.vehicleType.name, online: !r.createdById })),
        ...recentRentals.map((r) => ({ kind: "RENTAL" as const, id: r.id, number: r.raNumber, at: r.createdAt, status: r.status, name: name({ customer: r.customer }), detail: r.vehicle.assignedId, online: false })),
      ].sort((a, b) => +b.at - +a.at).slice(0, 8),
    };
  }),
});
