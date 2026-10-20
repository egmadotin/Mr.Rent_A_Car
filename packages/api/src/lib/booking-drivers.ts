import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";

/**
 * "Drivers / Add More Drivers" on the Reserve / Start Rental forms: make a booking's additional drivers exactly `ids`
 * (never the primary customer; undesired customers are refused).
 */
export async function syncDrivers(tx: Prisma.TransactionClient, on: { reservationId: string } | { rentalId: string }, primaryId: string | null, ids: string[]) {
  const want = [...new Set(ids)].filter((x) => x !== primaryId);
  const undesired = await tx.customer.findFirst({ where: { id: { in: want }, isUndesired: true }, select: { firstName: true, lastName: true } });
  if (undesired) throw new TRPCError({ code: "BAD_REQUEST", message: `${undesired.firstName} ${undesired.lastName} is on the undesired list and can't be a driver.` });
  await tx.bookingDriver.deleteMany({ where: { ...on, customerId: { notIn: want } } });
  const have = new Set((await tx.bookingDriver.findMany({ where: on, select: { customerId: true } })).map((d) => d.customerId));
  const add = want.filter((x) => !have.has(x));
  if (add.length) await tx.bookingDriver.createMany({ data: add.map((customerId) => ({ ...on, customerId })) });
}
