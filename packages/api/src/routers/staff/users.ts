import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "@mrac/auth";
import { Prisma } from "@mrac/db";
import { permitted, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { ALL_PERMISSIONS, PERMISSION_SECTIONS } from "../../lib/permissions";

const optStr = z.string().trim().max(200).optional().transform((v) => v || null);

/** Settings > Users (AdminsMain.aspx) and User Groups (AdminGroupsMain.aspx / AdminGroupsModify.aspx). */
export const usersRouter = router({
  /** What the signed-in staff member may do (the UI hides / disables what they can't). */
  me: staffProcedure.query(async ({ ctx }) => {
    const me = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      select: { id: true, name: true, role: true, userGroup: { select: { name: true, isActive: true, permissions: true, maxDiscountType: true, maxDiscountValue: true } } },
    });
    const isAdmin = me.role === "admin";
    return {
      id: me.id,
      name: me.name,
      isAdmin,
      group: me.userGroup?.name ?? null,
      permissions: isAdmin ? ALL_PERMISSIONS : me.userGroup?.isActive ? me.userGroup.permissions : [],
      maxDiscount: isAdmin || !me.userGroup?.maxDiscountValue ? null : { type: me.userGroup.maxDiscountType ?? "PERCENT", value: Number(me.userGroup.maxDiscountValue) },
    };
  }),

  catalog: staffProcedure.query(() => PERMISSION_SECTIONS),

  list: permitted("Admins").query(({ ctx }) =>
    ctx.prisma.user.findMany({
      where: { kind: "STAFF" },
      orderBy: [{ banned: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true, userGroupId: true, userGroup: { select: { name: true } }, defaultLocationId: true, defaultLocation: { select: { name: true } }, commissionStructureIds: true, commissionType: true, commissionAmount: true },
    }),
  ),

  /** Add a staff user with a temporary password (they sign in with it and change it). */
  create: permitted("AdminsAdd")
    .input(
      z.object({
        name: z.string().trim().min(1, "Name is required").max(120),
        email: z.string().trim().toLowerCase().email("Enter a valid email"),
        password: z.string().min(10, "At least 10 characters"),
        userGroupId: optStr,
        defaultLocationId: optStr,
        isAdmin: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.isAdmin && (ctx.user as { role?: string | null }).role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create admins." });
      if (await ctx.prisma.user.findUnique({ where: { email: input.email } })) throw new TRPCError({ code: "CONFLICT", message: "A user with this email already exists." });
      const u = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          emailVerified: true,
          kind: "STAFF",
          role: input.isAdmin ? "admin" : "user",
          userGroupId: input.userGroupId,
          defaultLocationId: input.defaultLocationId,
          accounts: { create: { accountId: input.email, providerId: "credential", password: await hashPassword(input.password) } },
        },
      });
      await audit(ctx.prisma, "User", u.id, ctx.user.id, { Created: [null, input.email] });
      return { id: u.id };
    }),

  update: permitted("AdminsEdit")
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(120),
        userGroupId: optStr,
        defaultLocationId: optStr,
        isAdmin: z.boolean(),
        active: z.boolean(),
        /** Users form "Commission Structure" ticks and "Commission" (None / Percentage % / Dollar Amount $) */
        commissionStructureIds: z.array(z.string()).optional(),
        commissionType: z.preprocess((v) => (v === "" ? null : v), z.enum(["PERCENT", "AMOUNT"]).nullable().optional()),
        commissionAmount: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable().optional()),
        /** blank = keep */
        newPassword: z.string().optional().transform((v) => v || null).refine((v) => !v || v.length >= 10, "At least 10 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = ctx.user as { id: string; role?: string | null };
      const before = await ctx.prisma.user.findUniqueOrThrow({ where: { id: input.id } });
      if ((before.role === "admin") !== input.isAdmin && me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can grant or remove admin." });
      if (input.id === me.id && (!input.active || !input.isAdmin) && me.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove your own admin access or deactivate yourself." });
      await ctx.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.id },
          data: {
            name: input.name, userGroupId: input.userGroupId, defaultLocationId: input.defaultLocationId, role: input.isAdmin ? "admin" : "user", banned: !input.active, banReason: input.active ? null : "Deactivated in Settings > Users",
            ...(input.commissionStructureIds ? { commissionStructureIds: input.commissionStructureIds } : {}),
            ...(input.commissionType !== undefined ? { commissionType: input.commissionType, commissionAmount: input.commissionType ? input.commissionAmount ?? null : null } : {}),
          },
        });
        if (!input.active) await tx.session.deleteMany({ where: { userId: input.id } });
        if (input.newPassword) await tx.account.updateMany({ where: { userId: input.id, providerId: "credential" }, data: { password: await hashPassword(input.newPassword) } });
        await audit(tx, "User", input.id, me.id, {
          Group: [before.userGroupId, input.userGroupId],
          Admin: [before.role === "admin", input.isAdmin],
          Active: [!before.banned, input.active],
          Password: [null, input.newPassword ? "reset" : null],
        });
      });
      return { ok: true };
    }),

  groups: permitted("Admins").query(({ ctx }) =>
    ctx.prisma.userGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true, locationId: true, maxDiscountType: true, maxDiscountValue: true, permissions: true, _count: { select: { users: true } } },
    }),
  ),

  saveGroup: permitted("AdminsEdit")
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Description is required").max(80),
        isActive: z.boolean(),
        locationId: optStr,
        maxDiscountType: z.enum(["PERCENT", "AMOUNT"]).nullable(),
        maxDiscountValue: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
        permissions: z.array(z.string()).transform((xs) => xs.filter((x) => ALL_PERMISSIONS.includes(x))),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, maxDiscountValue, ...rest } = input;
      const data = { ...rest, maxDiscountValue: maxDiscountValue == null ? null : new Prisma.Decimal(maxDiscountValue), maxDiscountType: maxDiscountValue == null ? null : rest.maxDiscountType ?? "PERCENT" };
      const g = id ? await ctx.prisma.userGroup.update({ where: { id }, data }) : await ctx.prisma.userGroup.create({ data });
      await audit(ctx.prisma, "UserGroup", g.id, ctx.user.id, { Name: [null, g.name], Permissions: [null, String(g.permissions.length)] });
      return { id: g.id };
    }),
});
