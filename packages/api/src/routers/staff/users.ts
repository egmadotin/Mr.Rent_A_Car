import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword } from "@mrac/auth";
import { Prisma } from "@mrac/db";
import { permitted, router, staffProcedure } from "../../trpc";
import { audit } from "../../lib/audit";
import { ALL_PERMISSIONS, PERMISSION_SECTIONS, effectivePermissions } from "../../lib/permissions";
import { allowedLocationIds } from "../../lib/location-access";

const optStr = z.string().trim().max(200).optional().transform((v) => v || null);
/** Users form "Permissions": every ticked box (the group's ticks plus / minus this user's own changes). */
const userPerms = z.array(z.string()).transform((xs) => xs.filter((x) => ALL_PERMISSIONS.includes(x))).optional();

/** Store a user's ticks as changes from their group: extra ones added, group ones taken away. */
async function permissionOverrides(db: Prisma.TransactionClient, userGroupId: string | null, ticked: string[]) {
  const group = userGroupId ? ((await db.userGroup.findUnique({ where: { id: userGroupId }, select: { permissions: true } }))?.permissions ?? []) : [];
  return { permissionsAdded: ticked.filter((p) => !group.includes(p)), permissionsRemoved: group.filter((p) => !ticked.includes(p)) };
}

/** Settings > Users (AdminsMain.aspx) and User Groups (AdminGroupsMain.aspx / AdminGroupsModify.aspx). */
export const usersRouter = router({
  /** What the signed-in staff member may do (the UI hides / disables what they can't). */
  me: staffProcedure.query(async ({ ctx }) => {
    const me = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
      select: { id: true, name: true, role: true, permissionsAdded: true, permissionsRemoved: true, userGroup: { select: { name: true, isActive: true, permissions: true, maxDiscountType: true, maxDiscountValue: true } } },
    });
    const isAdmin = me.role === "admin";
    return {
      id: me.id,
      name: me.name,
      isAdmin,
      group: me.userGroup?.name ?? null,
      permissions: effectivePermissions(me),
      maxDiscount: isAdmin || !me.userGroup?.maxDiscountValue ? null : { type: me.userGroup.maxDiscountType ?? "PERCENT", value: Number(me.userGroup.maxDiscountValue) },
      /** Location Access: the branches this user may work in (null = all) */
      locationIds: await allowedLocationIds(ctx.prisma, me.id),
    };
  }),

  catalog: staffProcedure.query(() => PERMISSION_SECTIONS),

  list: permitted("Admins").query(({ ctx }) =>
    ctx.prisma.user.findMany({
      where: { kind: "STAFF" },
      orderBy: [{ banned: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, banned: true, createdAt: true, userGroupId: true, userGroup: { select: { name: true } }, defaultLocationId: true, defaultLocation: { select: { name: true } }, locationIds: true, permissionsAdded: true, permissionsRemoved: true, commissionStructureIds: true, commissionType: true, commissionAmount: true },
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
        /** Location Access ticks (none = the group's location, else all) */
        locationIds: z.array(z.string()).default([]),
        permissions: userPerms,
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
          locationIds: input.locationIds,
          ...(input.permissions ? await permissionOverrides(ctx.prisma, input.userGroupId, input.permissions) : {}),
        },
      });
      // Better Auth finds an email/password login by accountId = the user's id (not the email)
      await ctx.prisma.account.create({ data: { userId: u.id, accountId: u.id, providerId: "credential", password: await hashPassword(input.password) } });
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
        locationIds: z.array(z.string()).optional(),
        permissions: userPerms,
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
            ...(input.locationIds ? { locationIds: input.locationIds } : {}),
            ...(input.permissions ? await permissionOverrides(tx, input.userGroupId, input.permissions) : {}),
            ...(input.commissionType !== undefined ? { commissionType: input.commissionType, commissionAmount: input.commissionType ? input.commissionAmount ?? null : null } : {}),
          },
        });
        if (!input.active) await tx.session.deleteMany({ where: { userId: input.id } });
        if (input.newPassword) await tx.account.updateMany({ where: { userId: input.id, providerId: "credential" }, data: { password: await hashPassword(input.newPassword) } });
        await audit(tx, "User", input.id, me.id, {
          Group: [before.userGroupId, input.userGroupId],
          "Extra permissions": [before.permissionsAdded.join(", "), input.permissions ? (await permissionOverrides(tx, input.userGroupId, input.permissions)).permissionsAdded.join(", ") : before.permissionsAdded.join(", ")],
          "Removed permissions": [before.permissionsRemoved.join(", "), input.permissions ? (await permissionOverrides(tx, input.userGroupId, input.permissions)).permissionsRemoved.join(", ") : before.permissionsRemoved.join(", ")],
          "Location Access": [before.locationIds.join(", "), input.locationIds ? input.locationIds.join(", ") : before.locationIds.join(", ")],
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
