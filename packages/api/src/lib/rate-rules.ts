import { Prisma } from "@mrac/db";
import { localDateAsUtc } from "./tz";

type Tx = Prisma.TransactionClient;
const DAY = 86_400_000;

/**
 * Rate Blocking, Rate Values Update, Rate Utilization and Overbooking Control (Settings > Rates), applied when a rate is
 * listed / picked and when a booking is priced. Dates are the location's local calendar days (stored as UTC midnight).
 */
const matchesDay = (r: { startDate: Date; endDate: Date; weekdays?: boolean[] }, day: Date) =>
  +r.startDate <= +day && +day <= +r.endDate && (!r.weekdays || r.weekdays.length !== 7 || r.weekdays[day.getUTCDay()]);

/** Rates that can't be picked up on this day (Rate Blocking). "all" = every rate at the location is blocked. */
export async function blockedRates(tx: Tx, input: { locationId: string; vehicleTypeId?: string | null; pickupAt: Date; tz: string }) {
  const day = localDateAsUtc(input.pickupAt, input.tz);
  const rules = await tx.rateRule.findMany({
    where: {
      kind: "BLOCK",
      locationId: input.locationId,
      startDate: { lte: day },
      endDate: { gte: day },
      ...(input.vehicleTypeId ? { OR: [{ vehicleTypeId: null }, { vehicleTypeId: input.vehicleTypeId }] } : {}),
    },
  });
  const hits = rules.filter((r) => matchesDay(r, day));
  if (hits.some((r) => !r.rateId)) return "all" as const;
  return new Set(hits.map((r) => r.rateId!));
}
export const isBlocked = (blocked: Awaited<ReturnType<typeof blockedRates>>, rateId: string) => blocked === "all" || blocked.has(rateId);

/** Share of the vehicle type's fleet at the location booked or on rent on this day (0 when there is no fleet). */
export async function utilizationOn(tx: Tx, input: { locationId: string; vehicleTypeId: string; day: Date }) {
  const from = input.day;
  const to = new Date(+input.day + DAY);
  const [fleet, reserved, onRent] = await Promise.all([
    tx.vehicle.count({ where: { isActive: true, vehicleTypeId: input.vehicleTypeId, rentalLocationId: input.locationId } }),
    tx.reservation.count({
      where: {
        deletedAt: null,
        status: { in: ["TENTATIVE", "CONFIRMED"] },
        pickupLocationId: input.locationId,
        vehicleTypeId: input.vehicleTypeId,
        pickupAt: { lt: to },
        returnAt: { gt: from },
      },
    }),
    tx.rental.count({
      where: { status: "OPEN", checkOutLocationId: input.locationId, vehicleTypeId: input.vehicleTypeId, checkOutAt: { lt: to }, expectedReturnAt: { gt: from } },
    }),
  ]);
  return { fleet, booked: reserved + onRent, pct: fleet ? ((reserved + onRent) / fleet) * 100 : 0 };
}

const applyChange = (daily: Prisma.Decimal, type: "PERCENT" | "FLAT" | "TOTAL" | null, value: Prisma.Decimal | null) => {
  if (!type || value == null) return daily;
  if (type === "PERCENT") return daily.mul(new Prisma.Decimal(100).add(value)).div(100);
  if (type === "FLAT") return daily.add(value);
  return value;
};

/**
 * The daily price for each day of the rental after Rate Values Update adjustments (per day, on matching weekdays) and
 * Rate Utilization (by how full the vehicle type is on the pickup day). Returns null when nothing applies, so the
 * booking keeps its plain daily × days pricing.
 */
export async function adjustedDailies(
  tx: Tx,
  input: { locationId: string; rateId: string; vehicleTypeId: string; pickupAt: Date; days: number; daily: Prisma.Decimal; tz: string },
) {
  const first = localDateAsUtc(input.pickupAt, input.tz);
  const last = new Date(+first + Math.max(0, input.days - 1) * DAY);
  const scope = {
    locationId: input.locationId,
    startDate: { lte: last },
    endDate: { gte: first },
    AND: [{ OR: [{ rateId: null }, { rateId: input.rateId }] }, { OR: [{ vehicleTypeId: null }, { vehicleTypeId: input.vehicleTypeId }] }],
  };
  const [adjust, util] = await Promise.all([
    tx.rateRule.findMany({ where: { kind: "ADJUST", ...scope }, orderBy: { createdAt: "asc" } }),
    tx.rateUtilization.findMany({ where: { ...scope, startDate: { lte: first }, endDate: { gte: first } }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);
  if (!adjust.length && !util.length) return null;

  let utilPct: Prisma.Decimal | null = null;
  let utilization: number | null = null;
  if (util[0]) {
    const u = await utilizationOn(tx, { locationId: input.locationId, vehicleTypeId: input.vehicleTypeId, day: first });
    utilization = u.pct;
    const tier = Math.min(15, Math.max(0, Math.floor(u.pct / 10)));
    const t = util[0].tiers[tier];
    if (t && !t.isZero()) utilPct = t;
  }
  const dailies: Prisma.Decimal[] = [];
  for (let i = 0; i < Math.max(1, input.days); i++) {
    const day = new Date(+first + i * DAY);
    // the newest matching rule wins on a day, like RentCentric's last Save
    const rule = adjust.filter((r) => matchesDay(r, day)).at(-1);
    let d = rule ? applyChange(input.daily, rule.changeType, rule.value) : input.daily;
    if (utilPct) d = d.mul(new Prisma.Decimal(100).add(utilPct)).div(100);
    dailies.push(Prisma.Decimal.max(d, 0));
  }
  if (!adjust.length && !utilPct) return null;
  return { dailies, utilization, utilizationPct: utilPct };
}

/** Extra bookings Overbooking Control allows for this vehicle type on the pickup day. */
export async function overbookAllowance(tx: Tx, input: { locationId: string; vehicleTypeId: string; pickupAt: Date; tz: string }) {
  const day = localDateAsUtc(input.pickupAt, input.tz);
  const rule = await tx.overbooking.findFirst({
    where: { locationId: input.locationId, vehicleTypeId: input.vehicleTypeId, startDate: { lte: day }, endDate: { gte: day } },
    orderBy: { createdAt: "desc" },
  });
  if (!rule || rule.overbookBy <= 0) return 0;
  if (rule.unit === "UNIT") return rule.overbookBy;
  const fleet = await tx.vehicle.count({ where: { isActive: true, vehicleTypeId: input.vehicleTypeId, rentalLocationId: input.locationId } });
  return Math.ceil((fleet * rule.overbookBy) / 100);
}
