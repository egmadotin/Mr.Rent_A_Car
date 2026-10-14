import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { withBookingGuard } from "../../lib/errors";

/** Legacy Visual Scheduler legend, plus overdue (an open rental past its return date). */
export type BarKind = "UNASSIGNED" | "RESERVATION" | "RENTAL" | "ONE_WAY" | "OVERDUE";

export type Bar = {
  id: string;
  kind: BarKind;
  startsAt: Date;
  endsAt: Date;
  label: string;
  href: string;
  reservationId: string | null;
  vehicleTypeId: string;
  pickupLocation: string;
  returnLocation: string;
};

export const calendarRouter = router({
  /** Vehicle × time grid for a date range (Reports > Visual Scheduler). */
  range: staffProcedure
    .input(
      z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
        locationId: z.string().optional(),
        vehicleTypeId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.to <= input.from) throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start." });
      const now = new Date();
      const overlaps = { startsAt: { lt: input.to }, endsAt: { gt: input.from } };

      const [vehicles, vehicleTypes, unassigned] = await Promise.all([
        ctx.prisma.vehicle.findMany({
          where: { isActive: true, rentalLocationId: input.locationId, vehicleTypeId: input.vehicleTypeId },
          orderBy: [{ vehicleType: { name: "asc" } }, { assignedId: "asc" }],
          select: {
            id: true,
            assignedId: true,
            status: true,
            year: true,
            licenseNumber: true,
            make: { select: { name: true } },
            model: { select: { name: true } },
            vehicleType: { select: { id: true, name: true } },
            blocks: {
              where: overlaps,
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                reservation: {
                  select: {
                    id: true, number: true, firstName: true, lastName: true, vehicleTypeId: true,
                    pickupLocation: { select: { id: true, name: true } }, returnLocation: { select: { id: true, name: true } },
                  },
                },
                rental: {
                  select: {
                    id: true, raNumber: true, status: true, expectedReturnAt: true, vehicleTypeId: true,
                    customer: { select: { firstName: true, lastName: true } },
                    checkOutLocation: { select: { id: true, name: true } }, checkInLocation: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        }),
        ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        ctx.prisma.reservation.findMany({
          where: {
            deletedAt: null,
            vehicleId: null,
            status: { in: ["TENTATIVE", "CONFIRMED"] },
            pickupAt: { lt: input.to },
            returnAt: { gt: input.from },
            pickupLocationId: input.locationId,
            vehicleTypeId: input.vehicleTypeId,
          },
          orderBy: { pickupAt: "asc" },
          select: {
            id: true, number: true, firstName: true, lastName: true, pickupAt: true, returnAt: true, vehicleTypeId: true,
            vehicleType: { select: { name: true } },
            pickupLocation: { select: { name: true } }, returnLocation: { select: { name: true } },
          },
        }),
      ]);

      const rows = vehicles.map((v) => ({
        vehicle: {
          id: v.id,
          assignedId: v.assignedId,
          status: v.status,
          title: `${v.year ?? ""} ${v.make.name} ${v.model.name}`.trim(),
          plate: v.licenseNumber,
          vehicleType: v.vehicleType,
        },
        bars: v.blocks.map((b): Bar => {
          if (b.rental) {
            const r = b.rental;
            const overdue = r.status === "OPEN" && r.expectedReturnAt < now;
            const oneWay = r.checkOutLocation.id !== r.checkInLocation.id;
            return {
              id: b.id,
              kind: overdue ? "OVERDUE" : oneWay ? "ONE_WAY" : "RENTAL",
              startsAt: b.startsAt,
              endsAt: overdue ? now : b.endsAt,
              label: `RA ${r.raNumber} · ${r.customer.firstName} ${r.customer.lastName}`,
              href: `/admin/rentals/${r.id}`,
              reservationId: null,
              vehicleTypeId: r.vehicleTypeId,
              pickupLocation: r.checkOutLocation.name,
              returnLocation: r.checkInLocation.name,
            };
          }
          const r = b.reservation!;
          return {
            id: b.id,
            kind: r.pickupLocation.id !== r.returnLocation.id ? "ONE_WAY" : "RESERVATION",
            startsAt: b.startsAt,
            endsAt: b.endsAt,
            label: `Res ${r.number} · ${r.firstName} ${r.lastName}`,
            href: `/admin/reservations/${r.id}`,
            reservationId: r.id,
            vehicleTypeId: r.vehicleTypeId,
            pickupLocation: r.pickupLocation.name,
            returnLocation: r.returnLocation.name,
          };
        }),
      }));

      const unassignedBars: (Bar & { vehicleTypeName: string })[] = unassigned.map((r) => ({
        id: `res_${r.id}`,
        kind: "UNASSIGNED",
        startsAt: r.pickupAt,
        endsAt: r.returnAt,
        label: `Res ${r.number} · ${r.firstName} ${r.lastName}`,
        href: `/admin/reservations/${r.id}`,
        reservationId: r.id,
        vehicleTypeId: r.vehicleTypeId,
        vehicleTypeName: r.vehicleType.name,
        pickupLocation: r.pickupLocation.name,
        returnLocation: r.returnLocation.name,
      }));

      return { rows, unassigned: unassignedBars, vehicleTypes };
    }),

  /**
   * Assign (or move) a reservation to a specific vehicle — the drag action on the calendar.
   * Same vehicle type only; changing type is an upgrade and belongs on the reservation screen.
   * Double-booking is rejected by the database's exclusion constraint.
   */
  assignReservation: staffProcedure
    .input(z.object({ reservationId: z.string(), vehicleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          const res = await tx.reservation.findFirst({ where: { id: input.reservationId, deletedAt: null } });
          if (!res) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found." });
          if (!["TENTATIVE", "CONFIRMED"].includes(res.status))
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only tentative or confirmed reservations can be reassigned." });
          const v = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } });
          if (v.vehicleTypeId !== res.vehicleTypeId)
            throw new TRPCError({ code: "BAD_REQUEST", message: "That vehicle is a different type. Change the type on the reservation first." });
          await tx.vehicleBlock.deleteMany({ where: { reservationId: res.id } });
          await tx.vehicleBlock.create({ data: { vehicleId: v.id, reservationId: res.id, startsAt: res.pickupAt, endsAt: res.returnAt } });
          await tx.reservation.update({ where: { id: res.id }, data: { vehicleId: v.id } });
          await audit(tx, "Reservation", res.id, ctx.user.id, { Vehicle: [res.vehicleId, v.assignedId] });
        }),
      );
    }),
});
