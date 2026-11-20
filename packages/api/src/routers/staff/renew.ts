import { z } from "zod";
import type { Prisma } from "@mrac/db";
import { permitted, router } from "../../trpc";

/**
 * Settings > Import Data and Other Tools > Renew Rental Agreements (ReOpenAgreementsMain.aspx — the page crashes in
 * RentCentric itself; its name says what it does): find closed rental agreements and re-open them (Rentals' Re-open,
 * same permission "Allow ReOpen Rentals").
 */
const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
const day = (s: string, end = false) => new Date(`${s}T${end ? "23:59:59" : "00:00:00"}Z`);

export const renewRouter = router({
  closed: permitted("chkAllowReOpenRentals")
    .input(z.object({ q: z.string().trim().max(80).optional(), locationId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input: i }) => {
      const n = i.q && /^\d+$/.test(i.q) ? Number(i.q) : null;
      const where: Prisma.RentalWhereInput = {
        status: "CLOSED",
        deletedAt: null,
        ...(i.q
          ? { OR: [...(n != null ? [{ raNumber: n }] : []), { customer: { OR: [{ firstName: ci(i.q) }, { lastName: ci(i.q) }] } }, { vehicle: { assignedId: ci(i.q) } }] }
          : {}),
        ...(i.locationId ? { checkOutLocationId: i.locationId } : {}),
        ...(i.from || i.to ? { checkedInAt: { ...(i.from ? { gte: day(i.from) } : {}), ...(i.to ? { lte: day(i.to, true) } : {}) } } : {}),
      };
      const rows = await ctx.prisma.rental.findMany({
        where,
        orderBy: { checkedInAt: "desc" },
        take: 200,
        select: {
          id: true, raNumber: true, checkOutAt: true, checkedInAt: true,
          customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { assignedId: true, status: true } },
          checkOutLocation: { select: { name: true, timeZone: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, raNumber: r.raNumber, checkOutAt: r.checkOutAt, checkedInAt: r.checkedInAt, timeZone: r.checkOutLocation.timeZone,
        customer: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : "", unit: r.vehicle.assignedId, vehicleStatus: r.vehicle.status, location: r.checkOutLocation.name,
      }));
    }),
});
