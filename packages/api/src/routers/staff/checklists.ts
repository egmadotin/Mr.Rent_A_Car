import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, permitted, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Vehicle checklists as RentCentric's:
 * - Settings > Vehicle CheckList (VehicleCheckListMain / Add) and Vehicle CheckList Items (VehicleCheckListItemsMain / Add)
 * - the vehicle page's "Vehicle Checklist" (VehicleCheckListOutReturnMain / Modify): one checklist per booking, every
 *   item of the checklists that apply to the vehicle's type ticked or not, with a note
 * - Reports > Checklist Overview (ReportsChecklistOverview)
 */

const optStr = z.string().trim().max(4000).optional().nullable().transform((v) => v || null);
const req = (label: string) => z.string().trim().min(1, `${label} is required`).max(200);
const DAY = 86_400_000;
const applies = (typeIds: string[], vehicleTypeId: string) => typeIds.length === 0 || typeIds.includes(vehicleTypeId);

export const checklistsRouter = router({
  // ── Settings ────────────────────────────────────────────────────────────────

  list: staffProcedure.query(({ ctx }) =>
    ctx.prisma.vehicleChecklist.findMany({ orderBy: { name: "asc" }, include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } }),
  ),

  save: permitted("Settings")
    .input(z.object({ id: z.string().optional(), name: req("Vehicle CheckList Name"), vehicleTypeIds: z.array(z.string()).default([]), memo: optStr }))
    .mutation(async ({ ctx, input }) => {
      const data = { name: input.name, vehicleTypeIds: input.vehicleTypeIds, memo: input.memo };
      const c = input.id ? await ctx.prisma.vehicleChecklist.update({ where: { id: input.id }, data }) : await ctx.prisma.vehicleChecklist.create({ data });
      await audit(ctx.prisma, "VehicleChecklist", c.id, ctx.user.id, { Name: [null, c.name] });
      return { id: c.id };
    }),

  delete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const used = await ctx.prisma.vehicleChecklistResult.count({ where: { item: { checklistId: input.id } } });
    if (used) throw new TRPCError({ code: "CONFLICT", message: `This checklist is used on ${used} vehicle checklist line(s); it can't be deleted.` });
    await ctx.prisma.vehicleChecklist.delete({ where: { id: input.id } });
  }),

  saveItem: permitted("Settings")
    .input(
      z.object({
        id: z.string().optional(),
        checklistId: z.string().min(1, "Vehicle CheckList Name is required"),
        name: req("Vehicle CheckList Item Name"),
        statusColor: z.enum(["NONE", "RED", "GREEN"]).default("NONE"),
        vehicleTypeIds: z.array(z.string()).default([]),
        memo: optStr,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = { checklistId: input.checklistId, name: input.name, statusColor: input.statusColor, vehicleTypeIds: input.vehicleTypeIds, memo: input.memo };
      const i = input.id
        ? await ctx.prisma.vehicleChecklistItem.update({ where: { id: input.id }, data })
        : await ctx.prisma.vehicleChecklistItem.create({ data: { ...data, sortOrder: await ctx.prisma.vehicleChecklistItem.count({ where: { checklistId: input.checklistId } }) } });
      return { id: i.id };
    }),

  deleteItem: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const used = await ctx.prisma.vehicleChecklistResult.count({ where: { itemId: input.id } });
    if (used) throw new TRPCError({ code: "CONFLICT", message: `This item is used on ${used} vehicle checklist(s); it can't be deleted.` });
    await ctx.prisma.vehicleChecklistItem.delete({ where: { id: input.id } });
  }),

  // ── Vehicle page: Vehicle Checklist ─────────────────────────────────────────

  /** The vehicle's checklists (Pickup Date, Return Date, Milage, Delivery Or PickUp, Memo, DateEntered) + the items that apply to it. */
  forVehicle: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const v = await ctx.prisma.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId }, select: { vehicleTypeId: true, currentOdometer: true } });
    const [records, checklists, reservations] = await Promise.all([
      ctx.prisma.vehicleChecklistRecord.findMany({
        where: { vehicleId: input.vehicleId },
        orderBy: { pickupAt: "desc" },
        include: { results: true, reservation: { select: { id: true, number: true, firstName: true, lastName: true } } },
      }),
      ctx.prisma.vehicleChecklist.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } } }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null, vehicleId: input.vehicleId },
        orderBy: { pickupAt: "desc" },
        take: 50,
        select: { id: true, number: true, firstName: true, lastName: true, pickupAt: true, returnAt: true },
      }),
    ]);
    const lists = checklists
      .filter((c) => applies(c.vehicleTypeIds, v.vehicleTypeId))
      .map((c) => ({ ...c, items: c.items.filter((i) => applies(i.vehicleTypeIds, v.vehicleTypeId)) }))
      .filter((c) => c.items.length);
    return { records, checklists: lists, reservations, odometer: v.currentOdometer };
  }),

  saveRecord: permitted("Vehicles")
    .input(
      z
        .object({
          id: z.string().optional(),
          vehicleId: z.string(),
          reservationId: optStr,
          pickupAt: z.coerce.date({ invalid_type_error: "Pickup Date is required" }),
          returnAt: z.coerce.date({ invalid_type_error: "Return Date is required" }),
          mileage: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0, "Can't be negative").nullable()),
          deliveryOrPickup: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
          memo: optStr,
          results: z.array(z.object({ itemId: z.string(), checked: z.boolean(), note: optStr })).default([]),
        })
        .superRefine((v, c) => {
          if (v.returnAt < v.pickupAt) c.addIssue({ code: "custom", path: ["returnAt"], message: "Return Date must be after Pickup Date" });
        }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const data = { reservationId: input.reservationId, pickupAt: input.pickupAt, returnAt: input.returnAt, mileage: input.mileage, deliveryOrPickup: input.deliveryOrPickup, memo: input.memo };
        const r = input.id
          ? await tx.vehicleChecklistRecord.update({ where: { id: input.id, vehicleId: input.vehicleId }, data })
          : await tx.vehicleChecklistRecord.create({ data: { ...data, vehicleId: input.vehicleId, enteredById: ctx.user.id } });
        await tx.vehicleChecklistResult.deleteMany({ where: { recordId: r.id } });
        const results = input.results.filter((x) => x.checked || x.note);
        if (results.length) await tx.vehicleChecklistResult.createMany({ data: results.map((x) => ({ recordId: r.id, itemId: x.itemId, checked: x.checked, note: x.note })) });
        await audit(tx, "Vehicle", input.vehicleId, ctx.user.id, { "Vehicle Checklist": [input.id ? "edited" : null, input.id ? "saved" : "added"] });
        return { id: r.id };
      }),
    ),

  deleteRecord: permitted("Vehicles").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.prisma.vehicleChecklistRecord.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "Vehicle", r.vehicleId, ctx.user.id, { "Vehicle Checklist": ["deleted", null] });
  }),

  // ── Reports > Checklist Overview ────────────────────────────────────────────

  /** Checklist Overview Report: Pickup Date, Return Date, Mileage, Delivery/PickUp, Vehicle ID, Reservation#, Full Name. */
  overview: staffProcedure
    .input(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), assignedId: z.string().trim().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.vehicleChecklistRecord.findMany({
        where: {
          ...(input.from || input.to ? { pickupAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lt: new Date(+input.to + DAY) } : {}) } } : {}),
          ...(input.assignedId ? { vehicle: { assignedId: { contains: input.assignedId, mode: "insensitive" } } } : {}),
        },
        orderBy: { pickupAt: "asc" },
        take: 3000,
        include: {
          vehicle: { select: { id: true, assignedId: true } },
          reservation: { select: { id: true, number: true, firstName: true, lastName: true } },
          results: { include: { item: { select: { name: true, statusColor: true, checklist: { select: { name: true } } } } } },
        },
      });
      return rows.map((r) => ({
        id: r.id, pickupAt: r.pickupAt, returnAt: r.returnAt, mileage: r.mileage, deliveryOrPickup: r.deliveryOrPickup, vehicleId: r.vehicle.id, assignedId: r.vehicle.assignedId,
        reservationId: r.reservation?.id ?? null, reservationNumber: r.reservation?.number ?? null, fullName: r.reservation ? `${r.reservation.firstName} ${r.reservation.lastName}` : "",
        items: r.results.map((x) => ({ checklist: x.item.checklist.name, name: x.item.name, color: x.item.statusColor, checked: x.checked, note: x.note })),
      }));
    }),
});
