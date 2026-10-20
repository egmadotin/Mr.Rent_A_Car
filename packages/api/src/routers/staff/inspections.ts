import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";
import { router, staffProcedure, permitted, requirePermission } from "../../trpc";
import { audit } from "../../lib/audit";
import { deleteFile, isStorageKey } from "../../lib/storage";

/**
 * Vehicle Inspection (VehicleInspection.aspx), Reservation Inspection (ReservationInspection.aspx), Inspection Comparison
 * (CustomerReportedDamagesComparison.aspx) and Customer Reported Damages (CustomerReportedDamages.aspx).
 * RentCentric fills these from its inspection / customer apps and only lists them; here staff add them with photos
 * (uploaded through /api/files first).
 */

const optStr = z.string().trim().max(4000).optional().nullable().transform((v) => v || null);
const optInt = (max: number) => z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0, "Can't be negative").max(max).nullable());
const image = z.object({
  key: z.string().refine(isStorageKey, "Bad file key"),
  fileName: z.string().trim().max(255),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().min(0),
});
const imageSelect = { id: true, s3Key: true, fileName: true, contentType: true } satisfies Prisma.AttachmentSelect;
const imageData = (images: z.infer<typeof image>[]) =>
  images.map((i) => ({ kind: i.contentType.startsWith("image/") ? ("IMAGE" as const) : ("DOCUMENT" as const), s3Key: i.key, fileName: i.fileName, contentType: i.contentType, sizeBytes: i.sizeBytes }));

/** The rental / reservation must be this vehicle's. */
async function checkBooking(tx: Prisma.TransactionClient, vehicleId: string, rentalId: string | null, reservationId: string | null) {
  if (rentalId && !(await tx.rental.findFirst({ where: { id: rentalId, OR: [{ vehicleId }, { vehicleSegments: { some: { vehicleId } } }] }, select: { id: true } })))
    throw new TRPCError({ code: "BAD_REQUEST", message: "That rental isn't for this vehicle." });
  if (reservationId && !(await tx.reservation.findFirst({ where: { id: reservationId }, select: { id: true } })))
    throw new TRPCError({ code: "BAD_REQUEST", message: "Reservation not found." });
}

const inspectionInclude = {
  images: { select: imageSelect, orderBy: { uploadedAt: "asc" } },
  rental: { select: { id: true, raNumber: true, customer: { select: { firstName: true, lastName: true } } } },
  reservation: { select: { id: true, number: true, firstName: true, lastName: true } },
  vehicle: { select: { id: true, assignedId: true, year: true, make: { select: { name: true } }, model: { select: { name: true } } } },
} satisfies Prisma.VehicleInspectionInclude;

export const inspectionsRouter = router({
  /** Inspections of a vehicle, a reservation or a rental (newest first), with who did them. */
  list: permitted("Vehicles")
    .input(z.object({ vehicleId: z.string().optional(), reservationId: z.string().optional(), rentalId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!input.vehicleId && !input.reservationId && !input.rentalId) return [];
      const rows = await ctx.prisma.vehicleInspection.findMany({
        where: { ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}), ...(input.reservationId ? { reservationId: input.reservationId } : {}), ...(input.rentalId ? { rentalId: input.rentalId } : {}) },
        orderBy: [{ at: "desc" }, { createdAt: "desc" }],
        include: inspectionInclude,
      });
      const ids = [...new Set(rows.map((r) => r.adminId).filter((x): x is string => !!x))];
      const names = new Map((await ctx.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      return rows.map((r) => ({ ...r, admin: (r.adminId && names.get(r.adminId)) || "" }));
    }),

  /** Add / edit an inspection; `images` are added (existing photos stay; remove them with deleteImage). */
  save: staffProcedure
    .input(
      z.object({
        id: z.string().optional(),
        vehicleId: z.string(),
        kind: z.enum(["PICKUP", "RETURN", "OTHER"]),
        at: z.coerce.date({ invalid_type_error: "Date is required" }),
        rentalId: optStr,
        reservationId: optStr,
        odometer: optInt(10_000_000),
        fuel: optInt(16),
        memo: optStr,
        images: z.array(image).max(40).default([]),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        await checkBooking(tx, input.vehicleId, input.rentalId, input.reservationId);
        const data = { kind: input.kind, at: input.at, rentalId: input.rentalId, reservationId: input.reservationId, odometer: input.odometer, fuel: input.fuel, memo: input.memo };
        const r = input.id
          ? await tx.vehicleInspection.update({ where: { id: input.id, vehicleId: input.vehicleId }, data })
          : await tx.vehicleInspection.create({ data: { ...data, vehicleId: input.vehicleId, adminId: ctx.user.id } });
        if (input.images.length) await tx.attachment.createMany({ data: imageData(input.images).map((i) => ({ ...i, inspectionId: r.id, vehicleId: input.vehicleId })) });
        await audit(tx, "Vehicle", input.vehicleId, ctx.user.id, { Inspection: [null, `${input.id ? "Edited" : "Added"} ${input.kind.toLowerCase()} inspection`] });
        return { id: r.id };
      }),
    ),

  delete: staffProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requirePermission(ctx, "DamagesEdit");
    const r = await ctx.prisma.vehicleInspection.findUniqueOrThrow({ where: { id: input.id }, include: { images: { select: { s3Key: true } } } });
    await ctx.prisma.$transaction(async (tx) => {
      await tx.vehicleInspection.delete({ where: { id: r.id } });
      await audit(tx, "Vehicle", r.vehicleId, ctx.user.id, { Inspection: [`${r.kind.toLowerCase()} inspection`, "Deleted"] });
    });
    await Promise.all(r.images.map((i) => deleteFile(i.s3Key)));
  }),

  /** Remove one photo from an inspection or a reported damage. */
  deleteImage: staffProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const a = await ctx.prisma.attachment.findUniqueOrThrow({ where: { id: input.id } });
    if (!a.inspectionId && !a.reportedDamageId) throw new TRPCError({ code: "BAD_REQUEST", message: "Not an inspection photo." });
    await ctx.prisma.attachment.delete({ where: { id: a.id } });
    await deleteFile(a.s3Key);
  }),

  /**
   * Inspection Comparison: per rental of the vehicle (or one rental), the pickup and return inspections side by side.
   * Columns as RentCentric: Customer, Rental #, Pickup Date, Return Date, Images.
   */
  comparison: permitted("Vehicles")
    .input(z.object({ vehicleId: z.string().optional(), rentalId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (!input.vehicleId && !input.rentalId) return [];
      const rows = await ctx.prisma.vehicleInspection.findMany({
        where: { rentalId: input.rentalId ?? { not: null }, ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}) },
        orderBy: { at: "asc" },
        include: { images: { select: imageSelect, orderBy: { uploadedAt: "asc" } }, rental: { select: { id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true } } } } },
      });
      const m = new Map<string, { rentalId: string; raNumber: number; customer: string; pickup: Date; return: Date; pickupImages: (typeof rows)[number]["images"]; returnImages: (typeof rows)[number]["images"]; otherImages: (typeof rows)[number]["images"] }>();
      for (const i of rows) {
        const r = i.rental!;
        const g = m.get(r.id) ?? { rentalId: r.id, raNumber: r.raNumber, customer: `${r.customer.firstName} ${r.customer.lastName}`, pickup: r.checkOutAt, return: r.checkedInAt ?? r.expectedReturnAt, pickupImages: [], returnImages: [], otherImages: [] };
        (i.kind === "PICKUP" ? g.pickupImages : i.kind === "RETURN" ? g.returnImages : g.otherImages).push(...i.images);
        m.set(r.id, g);
      }
      return [...m.values()].sort((a, b) => +b.pickup - +a.pickup);
    }),

  /** The vehicle's rentals and reservations, for the inspection / reported damage pickers (newest first). */
  bookings: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const [rentals, reservations] = await Promise.all([
      ctx.prisma.rental.findMany({
        where: { deletedAt: null, OR: [{ vehicleId: input.vehicleId }, { vehicleSegments: { some: { vehicleId: input.vehicleId } } }] },
        orderBy: { checkOutAt: "desc" },
        take: 50,
        select: { id: true, raNumber: true, checkOutAt: true, customerId: true, reservationId: true, customer: { select: { firstName: true, lastName: true } } },
      }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null, vehicleId: input.vehicleId },
        orderBy: { pickupAt: "desc" },
        take: 50,
        select: { id: true, number: true, pickupAt: true, customerId: true, firstName: true, lastName: true },
      }),
    ]);
    return { rentals, reservations };
  }),

  // ── Customer Reported Damages ─────────────────────────────────────────────────

  reportedDamages: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(({ ctx, input }) =>
    ctx.prisma.customerReportedDamage.findMany({
      where: { vehicleId: input.vehicleId },
      orderBy: { createdAt: "desc" },
      include: {
        images: { select: imageSelect, orderBy: { uploadedAt: "asc" } },
        customer: { select: { id: true, firstName: true, lastName: true } },
        reservation: { select: { id: true, number: true } },
        rental: { select: { id: true, raNumber: true } },
        condition: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
  ),

  saveReportedDamage: staffProcedure
    .input(
      z.object({
        vehicleId: z.string(),
        rentalId: optStr,
        reservationId: optStr,
        description: z.string().trim().min(1, "Description is required").max(4000),
        conditionId: optStr,
        locationId: optStr,
        images: z.array(image).max(40).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx, "DamagesAdd");
      return ctx.prisma.$transaction(async (tx) => {
        await checkBooking(tx, input.vehicleId, input.rentalId, input.reservationId);
        // the customer is the renter of the rental / reservation picked
        const customerId = input.rentalId
          ? (await tx.rental.findUniqueOrThrow({ where: { id: input.rentalId }, select: { customerId: true } })).customerId
          : input.reservationId
            ? (await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId }, select: { customerId: true } })).customerId
            : null;
        const d = await tx.customerReportedDamage.create({
          data: {
            vehicleId: input.vehicleId, rentalId: input.rentalId, reservationId: input.reservationId, customerId, description: input.description,
            conditionId: input.conditionId, locationId: input.locationId, enteredById: ctx.user.id,
            images: { create: imageData(input.images).map((i) => ({ ...i, vehicleId: input.vehicleId })) },
          },
        });
        await audit(tx, "Vehicle", input.vehicleId, ctx.user.id, { CustomerReportedDamage: [null, input.description.slice(0, 200)] });
        return { id: d.id };
      });
    }),

  deleteReportedDamage: staffProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await requirePermission(ctx, "DamagesEdit");
    const d = await ctx.prisma.customerReportedDamage.findUniqueOrThrow({ where: { id: input.id }, include: { images: { select: { s3Key: true } } } });
    await ctx.prisma.$transaction(async (tx) => {
      await tx.customerReportedDamage.delete({ where: { id: d.id } });
      await audit(tx, "Vehicle", d.vehicleId, ctx.user.id, { CustomerReportedDamage: [d.description.slice(0, 200), "Deleted"] });
    });
    await Promise.all(d.images.map((i) => deleteFile(i.s3Key)));
  }),
});
