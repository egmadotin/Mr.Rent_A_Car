import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@mrac/db";

type Db = Prisma.TransactionClient;
export type TokenPurpose = "customer-verify" | "customer-reset";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * One-time link token for a customer account (email verification / password reset). Only its hash is stored (in the
 * auth "verification" table), so a database leak doesn't leak usable links. Older tokens for the same purpose are dropped.
 */
export async function issueToken(db: Db, purpose: TokenPurpose, userId: string, ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  await db.verification.deleteMany({ where: { identifier: `${purpose}:${userId}` } });
  await db.verification.create({ data: { identifier: `${purpose}:${userId}`, value: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

/** The user id a valid, unexpired token belongs to (the token is used up), else null. */
export async function consumeToken(db: Db, purpose: TokenPurpose, token: string) {
  const v = await db.verification.findFirst({ where: { value: sha256(token), identifier: { startsWith: `${purpose}:` } } });
  if (!v) return null;
  await db.verification.delete({ where: { id: v.id } });
  if (v.expiresAt < new Date()) return null;
  return v.identifier.slice(purpose.length + 1);
}

/** Absolute link on the public site. */
export const siteUrl = (path: string) => new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3001").href;
