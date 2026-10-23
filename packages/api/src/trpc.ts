import { initTRPC, TRPCError } from "@trpc/server";
import { transformer } from "./transformer";
import { ZodError } from "zod";
import { prisma } from "@mrac/db";
import { auth, isStaff } from "@mrac/auth";
import { can, permissionLabel } from "./lib/permissions";

export async function createContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers });
  return { prisma, session, headers };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // fieldErrors keyed by full dotted path ("customer.firstName") so nested forms can show them
        zodError:
          error.cause instanceof ZodError
            ? {
                formErrors: error.cause.issues.filter((i) => i.path.length === 0).map((i) => i.message),
                fieldErrors: error.cause.issues.reduce<Record<string, string[]>>((acc, i) => {
                  if (i.path.length) (acc[i.path.join(".")] ??= []).push(i.message);
                  return acc;
                }, {}),
              }
            : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public site + future mobile app. Stable surface — version deliberately. */
export const publicProcedure = t.procedure;

/** Signed-in customer (public site "Login" / app); a staff session is not a customer. */
export const customerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || (ctx.session.user as { kind?: string }).kind !== "CUSTOMER") throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in." });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Staff ERP. */
export const staffProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!isStaff(ctx.session.user)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.session.user } });
});

/** Staff with the admin role — settings that hold secrets (payment gateway keys). */
export const adminProcedure = staffProcedure.use(({ ctx, next }) => {
  if ((ctx.user as { role?: string | null }).role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can change this setting." });
  return next();
});

/**
 * Staff who hold every listed permission (RentCentric user-group ticks; admins have all). The user's group is read
 * once per request. Use for actions a group can be denied: delete, void, refund, edit closed rentals, settings …
 */
export const permitted = (...perms: string[]) =>
  staffProcedure.use(async ({ ctx, next }) => {
    const u = ctx.user as { id: string; role?: string | null };
    if (u.role !== "admin") {
      const me = await ctx.prisma.user.findUnique({ where: { id: u.id }, select: { role: true, permissionsAdded: true, permissionsRemoved: true, userGroup: { select: { isActive: true, permissions: true } } } });
      const missing = perms.filter((p) => !(me && can(me, p)));
      if (missing.length) throw new TRPCError({ code: "FORBIDDEN", message: `You don't have permission for this (${missing.map(permissionLabel).join(", ")}). Ask an admin (Settings › Users).` });
    }
    return next();
  });

type PermCtx = { prisma: typeof prisma; user: { id: string } };

async function groupOf(ctx: PermCtx) {
  return ctx.prisma.user.findUnique({ where: { id: ctx.user.id }, select: { role: true, permissionsAdded: true, permissionsRemoved: true, userGroup: { select: { isActive: true, permissions: true, maxDiscountType: true, maxDiscountValue: true } } } });
}

/** Inside a procedure, when the permission depends on the input (e.g. refund vs payment, closed vs open rental). */
export async function requirePermission(ctx: PermCtx, permission: string) {
  const me = await groupOf(ctx);
  if (!me || !can(me, permission)) throw new TRPCError({ code: "FORBIDDEN", message: `You don't have permission for this (${permissionLabel(permission)}). Ask an admin to change your user group.` });
}

/** The user group's "Max Discount" (% or $); admins and groups without a maximum are not limited. */
export async function requireDiscountAllowed(ctx: PermCtx, type: string | null | undefined, value: number | null | undefined) {
  if (!value) return;
  const me = await groupOf(ctx);
  if (!me || me.role === "admin" || !me.userGroup?.maxDiscountValue) return;
  const max = Number(me.userGroup.maxDiscountValue);
  const sameKind = (me.userGroup.maxDiscountType ?? "PERCENT") === (type ?? "PERCENT");
  if (sameKind && value > max)
    throw new TRPCError({ code: "FORBIDDEN", message: `Your user group allows a discount of at most ${me.userGroup.maxDiscountType === "AMOUNT" ? `$${max}` : `${max}%`}.` });
}
