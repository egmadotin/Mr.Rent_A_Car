import { z } from "zod";
import { Prisma } from "@mrac/db";

const D = (n: number) => new Prisma.Decimal(n);
const optStr = z.string().trim().max(1000).optional().nullable().transform((v) => v || null);
const optDate = z.coerce.date().optional().nullable();
const money = z.coerce.number().finite();

/** "Add Bill Split" form (BillSplitModify.aspx) — shared by reservations and rentals. */
export const billSplitInput = z.object({
  companyId: z.string().min(1, "Company is required"),
  claimType: z.enum(["RENTER", "THIRD_PARTY", "OTHER"]),
  insuranceCompany: optStr,
  policyNumber: optStr,
  policyExpiry: optDate,
  prePaid: money.nonnegative().default(0),
  lumpSum: money.nonnegative().default(0),
  amountPerDay: money.nonnegative(),
  numberOfDays: z.coerce.number().int().nonnegative(),
  adjuster: optStr,
  insured: optStr,
  roNumber: optStr,
  poNumber: optStr,
  lossDate: optDate,
  claimNumber: optStr,
  maxPay: money.nonnegative().optional().nullable(),
  percentCoPay: z.coerce.number().int().min(0).max(100).default(0),
  payAllTaxes: z.boolean().default(false),
  taxIds: z.array(z.string()).default([]),
  payTotal: z.boolean().default(false),
  deductFromCustomersBalance: z.boolean().default(false),
  memo: optStr,
});

export function billSplitData(input: z.infer<typeof billSplitInput>) {
  const { taxIds, prePaid, lumpSum, amountPerDay, maxPay, ...rest } = input;
  return {
    ...rest,
    prePaid: D(prePaid),
    lumpSum: D(lumpSum),
    amountPerDay: D(amountPerDay),
    maxPay: maxPay == null ? null : D(maxPay),
    taxes: { create: taxIds.map((taxId) => ({ taxId })) },
  };
}

/** Pickup / drop-off row — shared by reservations and rentals. */
export const transportInput = z.object({
  pickupLocationId: optStr,
  pickupAddress: optStr,
  pickupAt: optDate,
  dropoffLocationId: optStr,
  dropoffAddress: optStr,
  dropoffAt: optDate,
  pickupMemo: optStr,
});
