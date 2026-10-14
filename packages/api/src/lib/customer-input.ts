import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";

const optStr = z.string().trim().max(2000).optional().nullable().transform((v) => v || null);
const optDate = z.preprocess((v) => (v === "" ? null : v), z.coerce.date().optional().nullable());
const req = (label: string) => z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`);

/** The renter / primary driver captured on the Reserve and Start a Rental "Customer" tabs. */
export const customerInput = z.object({
  firstName: req("First name"),
  middleName: optStr,
  lastName: req("Last name"),
  email: z.preprocess((v) => (v === "" ? null : v), z.string().email("Enter a valid email").nullable().optional()),
  phone: optStr,
  localPhone: optStr,
  /** "Employer Phone" (Start a Rental) */
  companyPhone: optStr,
  licenseNumber: optStr,
  licenseExpiry: optDate,
  licenseProvince: optStr,
  birthDate: optDate,
  address1: optStr,
  address2: optStr,
  city: optStr,
  province: optStr,
  postal: optStr,
  country: optStr,
  insuranceCompany: optStr,
  insurancePolicyNumber: optStr,
  insuranceExpiry: optDate,
  insurancePhone: optStr,
  insuranceFax: optStr,
  memo: optStr,
});
export type CustomerInput = z.infer<typeof customerInput>;

/**
 * Create the customer, or update the linked one when `save` is set. Undesired (do-not-rent) customers are refused
 * unless `allowUndesired`. Returns the customer id, or null when nothing was saved.
 */
export async function upsertBookingCustomer(
  tx: Prisma.TransactionClient,
  { customerId, customer, save, allowUndesired, locationId }: { customerId?: string | null; customer: CustomerInput; save: boolean; allowUndesired: boolean; locationId: string },
) {
  const { memo, ...c } = customer;
  if (customerId) {
    const existing = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (existing.isUndesired && !allowUndesired) throw new TRPCError({ code: "CONFLICT", message: "UNDESIRED_CUSTOMER" });
    if (save) await tx.customer.update({ where: { id: existing.id }, data: c });
    return existing.id;
  }
  if (!save) return null;
  const created = await tx.customer.create({ data: { ...c, enteredLocationId: locationId, defaultLocationId: locationId } });
  if (memo) await tx.memo.create({ data: { customerId: created.id, body: memo } });
  return created.id;
}
