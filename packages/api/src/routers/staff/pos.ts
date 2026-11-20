import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { permitted, router } from "../../trpc";
import { audit } from "../../lib/audit";

/**
 * Settings > Point Of Sale (as in RentCentric): Merchandise Items (ItemsSearchAddNew / ItemsModify.aspx) and Orders
 * (OrdersSearchAddNew / OrdersModify.aspx) — merchandise sold to clients, with lines (item, unit price, quantity,
 * tax %), Amount, Sales Tax, Total Sale, Payment and Balance.
 */
const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
const D = (n: number) => new Prisma.Decimal(n.toFixed(2));
const round2 = (n: number) => Math.round(n * 100) / 100;

const itemInput = z.object({
  itemNumber: z.string().trim().max(60).transform((s) => s || null),
  description: z.string().trim().min(1, "Description is required").max(200),
  unitPrice: z.number().min(0).max(1_000_000),
  quantity: z.number().int().min(0).max(1_000_000),
  memo: z.string().trim().max(2000).transform((s) => s || null),
  taxable: z.boolean(),
  locationId: z.string().nullable(),
});

const lineInput = z.object({
  itemId: z.string().nullable(),
  description: z.string().trim().min(1).max(200),
  unitPrice: z.number().min(0).max(1_000_000),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100_000),
  taxPercent: z.number().min(0).max(100),
});

const orderInput = z.object({
  poNumber: z.string().trim().max(60).transform((s) => s || null),
  enteredAt: z.coerce.date(),
  payMethod: z.string().trim().max(80).transform((s) => s || null),
  companyId: z.string().nullable(),
  customerName: z.string().trim().max(120).transform((s) => s || null),
  vehicleId: z.string().nullable(),
  memo: z.string().trim().max(2000).transform((s) => s || null),
  locationId: z.string().min(1, "Choose the location"),
  payment: z.number().min(0).max(10_000_000).nullable(),
  lines: z.array(lineInput).min(1, "Add at least one item").max(200),
});

/** Line amounts and the order totals (rounded per line, as on an invoice). */
export function orderTotals(lines: { unitPrice: number; quantity: number; taxPercent: number }[]) {
  const rows = lines.map((l) => {
    const amount = round2(l.unitPrice * l.quantity);
    return { amount, taxAmount: round2((amount * l.taxPercent) / 100) };
  });
  const amount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const salesTax = round2(rows.reduce((s, r) => s + r.taxAmount, 0));
  return { rows, amount, salesTax, totalSale: round2(amount + salesTax) };
}

const day = (s: string, end = false) => new Date(`${s}T${end ? "23:59:59" : "00:00:00"}Z`);

export const posRouter = router({
  options: permitted("Settings").query(async ({ ctx }) => {
    const [locations, companies, vehicles, items, users] = await Promise.all([
      ctx.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.vehicle.findMany({ where: { isActive: true }, orderBy: { assignedId: "asc" }, select: { id: true, assignedId: true, year: true, make: { select: { name: true } }, model: { select: { name: true } } } }),
      ctx.prisma.posItem.findMany({ orderBy: { description: "asc" }, select: { id: true, itemNumber: true, description: true, unitPrice: true, taxable: true } }),
      ctx.prisma.user.findMany({ where: { kind: "STAFF" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return {
      locations, companies, users,
      vehicles: vehicles.map((v) => ({ id: v.id, label: `${v.assignedId} — ${[v.year, v.make.name, v.model.name].filter(Boolean).join(" ")}` })),
      items: items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    };
  }),

  // ── Merchandise Items
  items: permitted("Settings")
    .input(z.object({ description: z.string().trim().max(200).optional(), itemNumber: z.string().trim().max(60).optional(), locationId: z.string().optional(), taxable: z.enum(["", "yes", "no"]).optional(), enteredById: z.string().optional() }))
    .query(async ({ ctx, input: i }) => {
      const rows = await ctx.prisma.posItem.findMany({
        where: {
          ...(i.description ? { description: ci(i.description) } : {}),
          ...(i.itemNumber ? { itemNumber: ci(i.itemNumber) } : {}),
          ...(i.locationId ? { locationId: i.locationId } : {}),
          ...(i.taxable ? { taxable: i.taxable === "yes" } : {}),
          ...(i.enteredById ? { enteredById: i.enteredById } : {}),
        },
        orderBy: { description: "asc" },
        take: 1000,
      });
      return rows.map((r) => ({ ...r, unitPrice: Number(r.unitPrice) }));
    }),

  item: permitted("Settings").input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const r = await ctx.prisma.posItem.findUnique({ where: { id: input.id } });
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "That item was deleted." });
    return { ...r, unitPrice: Number(r.unitPrice) };
  }),

  itemSave: permitted("Settings").input(z.object({ id: z.string().optional(), data: itemInput })).mutation(async ({ ctx, input }) => {
    const data = { ...input.data, unitPrice: D(input.data.unitPrice) };
    const r = input.id ? await ctx.prisma.posItem.update({ where: { id: input.id }, data }) : await ctx.prisma.posItem.create({ data: { ...data, enteredById: ctx.user.id } });
    await audit(ctx.prisma, "PosItem", r.id, ctx.user.id, { [input.id ? "Saved" : "Added"]: [null, r.description] });
    return { id: r.id };
  }),

  itemDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.prisma.posItem.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "PosItem", r.id, ctx.user.id, { Deleted: [r.description, null] });
  }),

  // ── Orders
  orders: permitted("Settings")
    .input(z.object({ q: z.string().trim().max(80).optional(), from: z.string().optional(), to: z.string().optional(), payMethod: z.string().optional(), locationId: z.string().optional(), enteredById: z.string().optional() }))
    .query(async ({ ctx, input: i }) => {
      const n = i.q && /^\d+$/.test(i.q) ? Number(i.q) : null;
      const rows = await ctx.prisma.posOrder.findMany({
        where: {
          ...(i.q ? { OR: [...(n != null ? [{ number: n }] : []), { payMethod: ci(i.q) }, { poNumber: ci(i.q) }, { customerName: ci(i.q) }] } : {}),
          ...(i.from || i.to ? { enteredAt: { ...(i.from ? { gte: day(i.from) } : {}), ...(i.to ? { lte: day(i.to, true) } : {}) } } : {}),
          ...(i.payMethod ? { payMethod: i.payMethod } : {}),
          ...(i.locationId ? { locationId: i.locationId } : {}),
          ...(i.enteredById ? { enteredById: i.enteredById } : {}),
        },
        orderBy: { enteredAt: "desc" },
        take: 1000,
        select: { id: true, number: true, enteredAt: true, totalSale: true, payment: true, payMethod: true, location: { select: { name: true } } },
      });
      return rows.map((r) => ({ id: r.id, number: r.number, enteredAt: r.enteredAt, amount: Number(r.totalSale), payment: Number(r.payment), balance: Number(r.totalSale) - Number(r.payment), payMethod: r.payMethod, location: r.location.name }));
    }),

  order: permitted("Settings").input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const o = await ctx.prisma.posOrder.findUnique({ where: { id: input.id }, include: { lines: { orderBy: { id: "asc" } } } });
    if (!o) throw new TRPCError({ code: "NOT_FOUND", message: "That order was deleted." });
    return {
      ...o, amount: Number(o.amount), salesTax: Number(o.salesTax), totalSale: Number(o.totalSale), payment: Number(o.payment),
      lines: o.lines.map((l) => ({ itemId: l.itemId, description: l.description, unitPrice: Number(l.unitPrice), quantity: l.quantity, taxPercent: Number(l.taxPercent) })),
    };
  }),

  orderSave: permitted("Settings").input(z.object({ id: z.string().optional(), data: orderInput })).mutation(({ ctx, input }) =>
    ctx.prisma.$transaction(async (tx) => {
      const { lines, payment, ...head } = input.data;
      const t = orderTotals(lines);
      const data = { ...head, amount: D(t.amount), salesTax: D(t.salesTax), totalSale: D(t.totalSale), payment: D(payment ?? t.totalSale) };
      const lineRows = lines.map((l, k) => ({ itemId: l.itemId, description: l.description, unitPrice: D(l.unitPrice), quantity: l.quantity, taxPercent: new Prisma.Decimal(l.taxPercent), amount: D(t.rows[k]!.amount), taxAmount: D(t.rows[k]!.taxAmount) }));
      let id = input.id;
      if (id) {
        await tx.posOrderLine.deleteMany({ where: { orderId: id } });
        await tx.posOrder.update({ where: { id }, data: { ...data, lines: { create: lineRows } } });
      } else {
        id = (await tx.posOrder.create({ data: { ...data, enteredById: ctx.user.id, lines: { create: lineRows } } })).id;
      }
      const o = await tx.posOrder.findUniqueOrThrow({ where: { id }, select: { number: true } });
      await audit(tx, "PosOrder", id, ctx.user.id, { [input.id ? "Saved" : "Added"]: [null, `Order ${o.number}: $${t.totalSale.toFixed(2)}`] });
      return { id, number: o.number };
    }),
  ),

  orderDelete: permitted("Settings").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const o = await ctx.prisma.posOrder.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "PosOrder", o.id, ctx.user.id, { Deleted: [`Order ${o.number}`, null] });
  }),
});
