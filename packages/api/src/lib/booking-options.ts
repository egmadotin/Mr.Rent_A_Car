import { z } from "zod";
import { rateOverrideInput } from "./rate-override";

/** The staff options grid, identical on Quote, Reserve and Start Rental (legacy GVOptions + Other Charges popup). */
export const bookingOptionsInput = z.object({
  insuranceIds: z.array(z.string()).default([]),
  miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.coerce.number().int().min(0).max(20) })).default([]),
  excludedTaxIds: z.array(z.string()).default([]),
  otherCharges: z
    .array(
      z.object({
        amount: z.coerce.number().finite(),
        detail: z.string().trim().max(200).optional().nullable(),
        description: z.string().trim().max(200).optional().nullable(),
      }),
    )
    .max(4)
    .default([]),
  /** "Rate (i)" Rate Details */
  rateOverride: rateOverrideInput.nullable().optional(),
  /** contract summary edits (double-click a charge), by line key: name, unit rate or lump sum — this booking only */
  chargeEdits: z
    .record(
      z.string().max(100),
      z.object({
        name: z.string().trim().max(100).nullable().optional(),
        mode: z.enum(["CALC", "UNIT", "LUMP"]),
        amount: z.coerce.number().finite().min(0, "Can't be negative").nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});
export type BookingOptionsInput = z.infer<typeof bookingOptionsInput>;

/** priceBooking() arguments for a staff booking: explicit selection, no automatic defaults. */
export function staffPricingOptions(o: BookingOptionsInput) {
  return {
    insuranceIds: o.insuranceIds,
    miscCharges: o.miscCharges,
    excludedTaxIds: o.excludedTaxIds,
    otherCharges: o.otherCharges.filter((x) => x.amount),
    rateOverride: o.rateOverride ?? null,
    chargeEdits: o.chargeEdits ?? null,
    includeDefaults: false,
  };
}
