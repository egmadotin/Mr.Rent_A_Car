import { initTRPC, TRPCError } from "@trpc/server";
import { transformer } from "./transformer";
import { ZodError } from "zod";
import { prisma } from "@mrac/db";
import { auth, isStaff } from "@mrac/auth";

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

/** Signed-in customer (portal / app). */
export const customerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** Staff ERP. */
export const staffProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (!isStaff(ctx.session.user)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.session.user } });
});
