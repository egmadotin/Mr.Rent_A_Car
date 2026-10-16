import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "@mrac/db";

/**
 * One auth system for staff (ERP) and, later, customers (portal + Expo app via the
 * @better-auth/expo plugin). `kind` separates the two; ERP routes require kind = STAFF.
 *
 * Self sign-up is disabled: staff accounts are created by an admin (or the seed).
 * Customer sign-up will be enabled when the customer portal is built.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      kind: { type: "string", required: false, defaultValue: "STAFF", input: false },
      userGroupId: { type: "string", required: false, input: false },
      defaultLocationId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12, // one staff shift
    updateAge: 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];

export function isStaff(user: { kind?: string | null } | null | undefined) {
  return user?.kind === "STAFF";
}

/** Password hashing for staff accounts created / reset in Settings > Users. */
export { hashPassword } from "better-auth/crypto";
