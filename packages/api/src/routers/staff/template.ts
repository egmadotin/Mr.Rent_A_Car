import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { codesFor, quoteTemplateFields, renderTemplate, rentalTemplateFields, reservationTemplateFields } from "../../lib/template-fields";

const KINDS = ["AGREEMENT", "RESERVATION", "QUOTE"] as const;

/** Settings > Rental Contracts & Invoices > Rentals & Invoices: printable templates. Staff print; admins edit. */
export const templateRouter = router({
  list: staffProcedure
    .input(z.object({ kind: z.enum(KINDS).optional(), locationId: z.string().optional(), activeOnly: z.boolean().default(false) }).default({}))
    .query(({ ctx, input }) =>
      ctx.prisma.documentTemplate.findMany({
        where: {
          ...(input.kind ? { kind: input.kind } : {}),
          ...(input.activeOnly ? { isActive: true } : {}),
          // a location's own templates plus shared (no location) ones
          ...(input.locationId ? { OR: [{ locationId: input.locationId }, { locationId: null }] } : {}),
        },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true, isActive: true, isDefault: true, autoPrint: true, emailFriendly: true, locationId: true, location: { select: { name: true } }, updatedAt: true },
      }),
    ),

  byId: staffProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const t = await ctx.prisma.documentTemplate.findUnique({ where: { id: input.id } });
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
    return t;
  }),

  /** The placeholder list for the editor (RentCentric's field tree: code → name). */
  fields: staffProcedure
    .input(z.object({ kind: z.enum(KINDS).default("AGREEMENT") }).default({}))
    .query(({ input }) => Object.entries(codesFor(input.kind)).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))),

  save: adminProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Name is required").max(120),
        kind: z.enum(KINDS),
        locationId: z.string().nullable(),
        html: z.string().max(2_000_000),
        isActive: z.boolean(),
        isDefault: z.boolean(),
        autoPrint: z.boolean(),
        emailFriendly: z.boolean(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const { id, ...data } = input;
        // one default per location and kind
        if (data.isDefault) await tx.documentTemplate.updateMany({ where: { kind: data.kind, locationId: data.locationId, isDefault: true, NOT: id ? { id } : undefined }, data: { isDefault: false } });
        const t = id
          ? await tx.documentTemplate.update({ where: { id }, data: { ...data, updatedById: ctx.user.id } })
          : await tx.documentTemplate.create({ data: { ...data, updatedById: ctx.user.id } });
        await audit(tx, "DocumentTemplate", t.id, ctx.user.id, { Name: [null, t.name], Saved: [null, new Date().toISOString()] });
        return { id: t.id };
      }),
    ),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.documentTemplate.delete({ where: { id: input.id } });
    await audit(ctx.prisma, "DocumentTemplate", input.id, ctx.user.id, { Deleted: [null, "yes"] });
    return { ok: true };
  }),

  /**
   * A rental (AGREEMENT), reservation (RESERVATION) or quote (QUOTE) printed with a template: by template id, by name (the
   * "Please Select … Printout" choice) or the location's default for that kind; `html` previews unsaved template HTML.
   * The document is found by id or by its number (RA # / reservation # / quote #).
   */
  render: staffProcedure
    .input(
      z.object({
        kind: z.enum(KINDS),
        id: z.string().optional(),
        number: z.coerce.number().int().optional(),
        templateId: z.string().optional(),
        name: z.string().optional(),
        html: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const byNum = (field: string) => (input.id ? { id: input.id } : { [field]: input.number ?? -1 });
      const doc =
        input.kind === "AGREEMENT"
          ? await ctx.prisma.rental.findFirst({ where: byNum("raNumber"), select: { id: true, checkOutLocationId: true } }).then((r) => r && { id: r.id, locationId: r.checkOutLocationId })
          : input.kind === "RESERVATION"
            ? await ctx.prisma.reservation.findFirst({ where: byNum("number"), select: { id: true, pickupLocationId: true } }).then((r) => r && { id: r.id, locationId: r.pickupLocationId })
            : await ctx.prisma.quote.findFirst({ where: byNum("number"), select: { id: true, pickupLocationId: true } }).then((r) => r && { id: r.id, locationId: r.pickupLocationId });
      if (!doc) return { name: null, html: null, notFound: true };
      const pick = (where: object) =>
        ctx.prisma.documentTemplate.findFirst({
          where: { kind: input.kind, isActive: true, ...(input.name ? { name: input.name } : { isDefault: true }), ...where },
          orderBy: { locationId: "desc" },
        });
      const t =
        input.html != null
          ? null
          : input.templateId
            ? await ctx.prisma.documentTemplate.findUnique({ where: { id: input.templateId } })
            : (await pick({ OR: [{ locationId: doc.locationId }, { locationId: null }] })) ??
              // no default at this location: its first active template of that kind, then any location's default
              (input.name ? null : await ctx.prisma.documentTemplate.findFirst({ where: { kind: input.kind, isActive: true, locationId: doc.locationId }, orderBy: { name: "asc" } })) ??
              (await pick({}));
      if (input.html == null && !t) return { name: null, html: null, notFound: false };
      const fields =
        input.kind === "AGREEMENT"
          ? await rentalTemplateFields(ctx.prisma, doc.id)
          : input.kind === "RESERVATION"
            ? await reservationTemplateFields(ctx.prisma, doc.id)
            : await quoteTemplateFields(ctx.prisma, doc.id);
      return { name: t?.name ?? "Preview", html: renderTemplate(input.html ?? t!.html, fields, input.kind), notFound: false };
    }),
});
