import { Prisma } from "@mrac/db";

type Line = { kind: string; total: Prisma.Decimal; tax?: { kind: string } | null };
type Pay = { transactionType: string; amount: Prisma.Decimal };
type Split = { amountPerDay: Prisma.Decimal; numberOfDays: number; lumpSum: Prisma.Decimal; prePaid: Prisma.Decimal };

const ZERO = new Prisma.Decimal(0);
const sum = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => a.add(b), ZERO);

/**
 * Legacy charge-table roll-up:
 *   Total T&KM → Discount → Fuel → Options Total → rental tax → Traffic Tickets → Admin Charge
 *   → Sub Total → taxes → Total → payments → Balance.
 * Authorizations are card holds: listed, but not counted toward Total Payments.
 */
export function rentalTotals(lines: Line[], payments: Pay[], billSplits: Split[] = []) {
  const by = (...kinds: string[]) => sum(lines.filter((l) => kinds.includes(l.kind)).map((l) => l.total));
  // Fixed-amount taxes (e.g. Passenger Vehicle Rental Tax $1.50/day) sit above Sub Total in the
  // legacy table; percentage taxes (GST / PST) are applied after it.
  const isPercentTax = (l: Line) => l.kind === "TAX" && l.tax?.kind !== "AMOUNT";
  const taxes = sum(lines.filter(isPercentTax).map((l) => l.total));
  const rentalTaxes = sum(lines.filter((l) => l.kind === "TAX" && !isPercentTax(l)).map((l) => l.total));
  const total = sum(lines.map((l) => l.total));
  const paid = sum(payments.filter((p) => p.transactionType === "PAYMENT").map((p) => p.amount));
  const refunded = sum(payments.filter((p) => p.transactionType === "REFUND").map((p) => p.amount));
  const totalPayments = paid.sub(refunded);
  const splitTotal = sum(billSplits.map((b) => b.amountPerDay.mul(b.numberOfDays).add(b.lumpSum)));
  const splitPrepaid = sum(billSplits.map((b) => b.prePaid));
  return {
    timeAndKm: by("TIME", "MILEAGE", "UPGRADE"),
    discount: by("DISCOUNT"),
    fuel: by("FUEL", "PREPAID_FUEL"),
    options: by("PROTECTION", "MISC", "ONE_WAY", "DAMAGES", "OTHER"),
    rentalTaxes,
    trafficTickets: by("TRAFFIC_TICKETS"),
    admin: by("ADMIN"),
    subTotal: total.sub(taxes),
    taxes,
    total,
    totalPayments,
    splitTotal,
    /** what the renter still owes after payments and company-billed portions */
    balance: total.sub(totalPayments).sub(splitTotal),
    splitBillBalance: splitTotal.sub(splitPrepaid),
  };
}
