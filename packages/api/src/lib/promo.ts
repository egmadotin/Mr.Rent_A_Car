import type { Prisma } from "@mrac/db";
import { localDateAsUtc } from "./tz";

type Db = Prisma.TransactionClient;

/**
 * Promotions/Specials: whether `code` gives a discount on this booking. A code works when it is Active, a Reservation
 * promo, the pickup day is between its Start and End Date (and booking today is on or before its Expiration Date),
 * the rental is at least its Minimum Days, the pickup location and vehicle type are ticked on it (none ticked = all),
 * and — for One Time Use — the customer (email) hasn't used it before.
 * Returns the promo, or `error` to show the customer.
 */
export async function checkPromo(
  db: Db,
  input: { code?: string | null; locationId: string; vehicleTypeId?: string | null; pickupAt: Date; returnAt: Date; email?: string | null },
) {
  const code = input.code?.trim();
  if (!code) return null;
  const p = await db.promoCode.findFirst({ where: { code: { equals: code, mode: "insensitive" } } });
  const bad = (error: string) => ({ promo: null, error });
  if (!p || !p.isActive || p.category !== "RESERVATION") return bad("That promo code isn't valid.");
  const loc = await db.location.findUnique({ where: { id: input.locationId }, select: { timeZone: true } });
  const day = localDateAsUtc(input.pickupAt, loc?.timeZone ?? "America/Vancouver");
  const today = localDateAsUtc(new Date(), loc?.timeZone ?? "America/Vancouver");
  if (day < p.startDate || day > p.endDate) return bad("That promo code isn't valid for these dates.");
  if (p.expirationDate && today > p.expirationDate) return bad("That promo code has expired.");
  const days = Math.max(1, Math.ceil((+input.returnAt - +input.pickupAt) / 86_400_000));
  if (days < p.minDays) return bad(`That promo code needs a rental of at least ${p.minDays} days.`);
  if (p.locationIds.length && !p.locationIds.includes(input.locationId)) return bad("That promo code isn't valid at this location.");
  if (input.vehicleTypeId && p.vehicleTypeIds.length && !p.vehicleTypeIds.includes(input.vehicleTypeId)) return bad("That promo code isn't valid for this vehicle.");
  if (p.oneTimeUse && input.email) {
    const used = await db.reservation.count({ where: { promoCodeId: p.id, deletedAt: null, status: { not: "CANCELLED" }, email: { equals: input.email, mode: "insensitive" } } });
    if (used) return bad("That promo code has already been used.");
  }
  return { promo: p, error: null };
}

/** The booking discount a promo gives (KM Discount isn't applied: online bookings have no km charge up front). */
export const promoDiscount = (p: { discountType: "PERCENT" | "AMOUNT"; discountValue: Prisma.Decimal }) => ({ discountType: p.discountType, discountValue: Number(p.discountValue) });
