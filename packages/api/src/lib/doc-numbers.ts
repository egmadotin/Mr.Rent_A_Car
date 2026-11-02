import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";

/**
 * Number Series (client request): quotes, reservations and rental agreements are numbered per location, e.g. Burnaby
 * from 100001 and Richmond from 200001, so the number shows where a booking belongs. A location's series runs from its
 * start up to the next higher start of any location; locations without a start share the series below the lowest start.
 * Numbers stay unique across all locations (the columns are still unique integers).
 */
export type DocKind = "quote" | "reservation" | "rental";

export const DOC_KINDS: { kind: DocKind; field: "quoteNumberStart" | "reservationNumberStart" | "rentalNumberStart"; label: string }[] = [
  { kind: "quote", field: "quoteNumberStart", label: "Quotes" },
  { kind: "reservation", field: "reservationNumberStart", label: "Reservations" },
  { kind: "rental", field: "rentalNumberStart", label: "Rental agreements" },
];
const fieldOf = (kind: DocKind) => DOC_KINDS.find((d) => d.kind === kind)!.field;
// one advisory lock per kind, so two bookings saved at once never take the same number
const LOCK: Record<DocKind, number> = { quote: 710_001, reservation: 710_002, rental: 710_003 };

/** The range [lo, hi) a location numbers from, given every location's start for that kind (hi null = no limit). */
export function seriesRange(starts: (number | null | undefined)[], own: number | null | undefined) {
  const set = [...new Set(starts.filter((s): s is number => s != null))].sort((a, b) => a - b);
  const lo = own ?? 1;
  const hi = set.find((s) => s > lo) ?? null;
  return { lo, hi };
}

/** Highest number already used in [lo, hi), including deleted / voided records. */
export async function maxNumberIn(tx: Prisma.TransactionClient, kind: DocKind, lo: number, hi: number | null) {
  const range = { gte: lo, ...(hi != null ? { lt: hi } : {}) };
  if (kind === "quote") return (await tx.quote.aggregate({ _max: { number: true }, where: { number: range } }))._max.number;
  if (kind === "reservation") return (await tx.reservation.aggregate({ _max: { number: true }, where: { number: range } }))._max.number;
  return (await tx.rental.aggregate({ _max: { raNumber: true }, where: { raNumber: range } }))._max.raNumber;
}

/** The next number for a new quote / reservation / rental at this location. Call inside the transaction that creates it. */
export async function nextDocNumber(tx: Prisma.TransactionClient, kind: DocKind, locationId: string | null | undefined): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK[kind]})`;
  const field = fieldOf(kind);
  const locs = await tx.location.findMany({ select: { id: true, quoteNumberStart: true, reservationNumberStart: true, rentalNumberStart: true } });
  const own = locs.find((l) => l.id === locationId)?.[field] ?? null;
  const { lo, hi } = seriesRange(locs.map((l) => l[field]), own);
  const max = await maxNumberIn(tx, kind, lo, hi);
  const next = max == null ? lo : max + 1;
  if (hi != null && next >= hi) {
    const label = DOC_KINDS.find((d) => d.kind === kind)!.label.toLowerCase();
    throw new TRPCError({
      code: "CONFLICT",
      message: `The ${label} number series ${lo}–${hi - 1} is full. An admin can set a new start in Settings > Number Series.`,
    });
  }
  return next;
}
