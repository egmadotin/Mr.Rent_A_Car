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
   * Dashboard (RentCentric Home3.aspx): Rentals Leaving Today, Returning Today, Vehicles Requiring Service and the
   * Rental Graph View (share of the fleet booked each day for the next 7 / 14 / 30 days).
   */
  dashboard: staffProcedure.input(z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(7) })).query(async ({ ctx, input }) => {
    const now = new Date();
    const today = startOfDayIn(now);
    const tomorrow = new Date(+today + 86_400_000);
    const active = ["TENTATIVE", "CONFIRMED"] as const;
    const [leaving, returning, vehicles, inFleet, rentals, reservations] = await Promise.all([
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
      ctx.prisma.vehicle.findMany({
        where: { isActive: true },
        select: { id: true, assignedId: true, status: true, currentOdometer: true, maintenanceBeginOdometer: true, maintenanceEveryKm: true, make: { select: { name: true } }, model: { select: { name: true } } },
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

    // service due: a repair / service status, or within 500 km of the next interval (Maintain every … km)
    const SERVICE_STATUSES = new Set(["IN_SERVICE", "IN_REPAIR", "HAS_PROBLEM", "OUT_OF_SERVICE", "GROUNDED"]);
    const service = vehicles
      .map((v) => {
        let dueAtKm: number | null = null;
        if (v.maintenanceEveryKm > 0 && v.currentOdometer != null) {
          const base = v.maintenanceBeginOdometer ?? 0;
          dueAtKm = base + Math.ceil(Math.max(1, v.currentOdometer - base) / v.maintenanceEveryKm) * v.maintenanceEveryKm;
        }
        const kmLeft = dueAtKm != null && v.currentOdometer != null ? dueAtKm - v.currentOdometer : null;
        const reason = SERVICE_STATUSES.has(v.status) ? "status" : kmLeft != null && kmLeft <= 500 ? "km" : null;
        return reason ? { id: v.id, assignedId: v.assignedId, vehicle: [v.make.name, v.model.name].join(" "), status: v.status, odometer: v.currentOdometer, dueAtKm, kmLeft, reason } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => (a.kmLeft ?? -1e9) - (b.kmLeft ?? -1e9));

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
      service,
      graph,
    };
  }),

  /** Dashboard "Vehicle Availability": free vehicles at a location for a period (optionally one type / one Vehicle ID). */
  availability: staffProcedure
    .input(z.object({ locationId: z.string().min(1), vehicleTypeId: z.string().optional(), assignedId: z.string().trim().optional(), from: z.coerce.date(), to: z.coerce.date() }))
    .query(async ({ ctx, input }) => {
      if (input.to <= input.from) throw new TRPCError({ code: "BAD_REQUEST", message: "“To” must be after “From”." });
      return ctx.prisma.vehicle.findMany({
        where: {
          isActive: true,
          rentalLocationId: input.locationId,
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}),
          status: { in: ["AVAILABLE", "ON_RENT"] },
          blocks: { none: { startsAt: { lt: input.to }, endsAt: { gt: input.from } } },
        },
        orderBy: { assignedId: "asc" },
        take: 100,
        select: { id: true, assignedId: true, year: true, licenseNumber: true, currentOdometer: true, make: { select: { name: true } }, model: { select: { name: true } }, vehicleType: { select: { name: true } } },
      });
    }),
});
