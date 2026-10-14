import { TRPCError } from "@trpc/server";

/** The VehicleBlock EXCLUDE constraint fired: the vehicle is already committed for overlapping dates. */
export function isDoubleBooking(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? "");
  return msg.includes("vehicle_block_no_overlap") || msg.includes("23P01");
}

/** Run a block; translate a double-booking violation into a friendly CONFLICT. */
export async function withBookingGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isDoubleBooking(e)) throw new TRPCError({ code: "CONFLICT", message: "That vehicle is already booked for some of those dates." });
    throw e;
  }
}
