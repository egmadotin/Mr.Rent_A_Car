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
});
