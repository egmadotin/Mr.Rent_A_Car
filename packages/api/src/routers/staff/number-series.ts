import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { DOC_KINDS, maxNumberIn, seriesRange } from "../../lib/doc-numbers";

const start = z.number().int().min(1).max(2_000_000_000).nullable();

/**
 * Settings > Location Information > Number Series (client request): each location's own starting number for quotes,
 * reservations and rental agreements. Anyone on staff can look; only admins (the super admin) can change it.
 */
export const numberSeriesRouter = router({
  list: staffProcedure.query(async ({ ctx }) => {
    const locs = await ctx.prisma.location.findMany({
      where: { OR: [{ isActive: true }, { quoteNumberStart: { not: null } }, { reservationNumberStart: { not: null } }, { rentalNumberStart: { not: null } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, isActive: true, quoteNumberStart: true, reservationNumberStart: true, rentalNumberStart: true },
    });
    const all = await ctx.prisma.location.findMany({ select: { quoteNumberStart: true, reservationNumberStart: true, rentalNumberStart: true } });
    // the next number each location would get, and where its series ends
    const rows = await Promise.all(
      locs.map(async (l) => {
        const series = await Promise.all(
          DOC_KINDS.map(async ({ kind, field }) => {
            const { lo, hi } = seriesRange(all.map((a) => a[field]), l[field]);
            const max = await maxNumberIn(ctx.prisma, kind, lo, hi);
            return { kind, start: l[field], next: max == null ? lo : max + 1, end: hi == null ? null : hi - 1 };
          }),
        );
        return { id: l.id, name: l.name, code: l.code, isActive: l.isActive, series };
      }),
    );
    return { rows, isAdmin: (ctx.user as { role?: string | null }).role === "admin" };
  }),

  save: adminProcedure
    .input(z.object({ locationId: z.string(), quoteNumberStart: start, reservationNumberStart: start, rentalNumberStart: start }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const before = await tx.location.findUniqueOrThrow({ where: { id: input.locationId } });
        const others = await tx.location.findMany({ where: { id: { not: input.locationId } }, select: { name: true, quoteNumberStart: true, reservationNumberStart: true, rentalNumberStart: true } });
        for (const { kind, field, label } of DOC_KINDS) {
          const s = input[field];
          if (s == null || s === before[field]) continue;
          const same = others.find((o) => o[field] === s);
          if (same) throw new TRPCError({ code: "BAD_REQUEST", message: `${label}: ${same.name} already starts at ${s}.` });
          // the new series must be unused, or numbers would mix with another location's (or end an existing series early)
          const { hi } = seriesRange([...others.map((o) => o[field]), s], s);
          const used = await maxNumberIn(tx, kind, s, hi);
          if (used != null)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${label}: number ${used} is already used in ${s}–${hi == null ? "…" : hi - 1}. Choose a start above ${used} or an unused range.`,
            });
        }
        await tx.location.update({
          where: { id: input.locationId },
          data: { quoteNumberStart: input.quoteNumberStart, reservationNumberStart: input.reservationNumberStart, rentalNumberStart: input.rentalNumberStart },
        });
        await audit(tx, "Location", input.locationId, ctx.user.id, {
          QuoteNumberStart: [before.quoteNumberStart, input.quoteNumberStart],
          ReservationNumberStart: [before.reservationNumberStart, input.reservationNumberStart],
          RentalNumberStart: [before.rentalNumberStart, input.rentalNumberStart],
        });
        return { ok: true };
      }),
    ),
});
