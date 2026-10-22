import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";

type Db = Prisma.TransactionClient;

/**
 * The branches a staff user may work in, or null for all of them: Full Admins → all; else the user's own
 * "Location Access" ticks (Settings › Users); else their user group's Location; else all.
 */
export async function allowedLocationIds(db: Db, userId: string): Promise<string[] | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, locationIds: true, userGroup: { select: { locationId: true } } } });
  if (!u || u.role === "admin") return null;
  if (u.locationIds.length) return u.locationIds;
  return u.userGroup?.locationId ? [u.userGroup.locationId] : null;
}

/** Refuse working at a branch the user has no access to (bookings created / moved there). */
export async function requireLocationAccess(db: Db, userId: string, ...locationIds: (string | null | undefined)[]) {
  const allowed = await allowedLocationIds(db, userId);
  if (!allowed) return;
  const ids = locationIds.filter((x): x is string => !!x);
  if (ids.some((id) => !allowed.includes(id))) {
    const names = await db.location.findMany({ where: { id: { in: ids.filter((id) => !allowed.includes(id)) } }, select: { name: true } });
    throw new TRPCError({ code: "FORBIDDEN", message: `You don't have access to ${names.map((n) => n.name).join(", ") || "that location"}. Ask an admin (Settings › Users › Location Access).` });
  }
}

/** Opening one booking: allowed when any of its branches (own / pick-up / return) is one of the user's. */
export async function requireAnyLocationAccess(db: Db, userId: string, ...locationIds: (string | null | undefined)[]) {
  const allowed = await allowedLocationIds(db, userId);
  if (!allowed || locationIds.some((id) => id && allowed.includes(id))) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "This booking is at a location you don't have access to. Ask an admin (Settings › Users › Location Access)." });
}
