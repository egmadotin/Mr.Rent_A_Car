import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, staffProcedure } from "../../trpc";
import { methodData, methodLabel } from "../../lib/payment-methods";
import { roleCommission, type Role, type Rules } from "../../lib/commissions";

/**
 * Core reports, as RentCentric's (same filters, columns and totals):
 * Daily Business Report (ReportsDBR), Daily Cash Summary (ReportsDCS), Month to Date (ReportsMonthToDate),
 * Rental Status (ReportsAgreementStatus), Reservation Manifest (ReportsReservationManifest), Vehicle Due In (ReportsVehicleDueIn).
 */

const optId = z.string().optional().transform((v) => v || undefined);
const optDate = z.coerce.date().optional();
const DAY = 86_400_000;
const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));
const round = (n: number) => Math.round(n * 100) / 100;

/** Rental days from the time lines: Daily / Extra Daily units, weeks × 7, months × 30. */
const rentalDays = (lines: { kind: string; name: string; units: Prisma.Decimal | number | null }[]) =>
  lines.filter((l) => l.kind === "TIME").reduce((a, l) => a + num(l.units) * (/week/i.test(l.name) ? 7 : /month/i.test(l.name) ? 30 : /dai|day/i.test(l.name) ? 1 : 0), 0);

/** RentCentric refuses date ranges over 31 days on the daily reports. */
function within31(from?: Date, to?: Date, label = "Date range") {
  if (from && to) {
    if (to < from) throw new TRPCError({ code: "BAD_REQUEST", message: `${label}: “To” must be after “From”.` });
    if (+to - +from > 31 * DAY) throw new TRPCError({ code: "BAD_REQUEST", message: `${label} can't exceed 31 days.` });
  }
}
const range = (from?: Date, to?: Date) => (from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(+to + DAY) } : {}) } : undefined);

const lineSelect = { kind: true, name: true, units: true, total: true, sortOrder: true, taxId: true, tax: { select: { name: true } }, insurance: { select: { name: true } }, miscCharge: { select: { name: true } } } satisfies Prisma.ChargeLineSelect;

type RevenueRental = Prisma.RentalGetPayload<{
  select: {
    id: true; raNumber: true; checkOutAt: true; checkedInAt: true; expectedReturnAt: true;
    customer: { select: { firstName: true; lastName: true } }; company: { select: { name: true } };
    vehicle: { select: { assignedId: true; year: true; make: { select: { name: true } }; model: { select: { name: true } } } };
    chargeLines: { select: typeof lineSelect }; payments: { select: { amount: true; transactionType: true; method: true; methodName: true } }; adjustments: { select: { amount: true } };
  };
}>;

/** The Daily Business Report / Month to Date body: one row per rental, then the revenue and payment summaries. */
function revenueReport(rentals: RevenueRental[]) {
  const rows = rentals.map((r) => {
    const by = (...k: string[]) => r.chargeLines.filter((l) => k.includes(l.kind)).reduce((a, l) => a + num(l.total), 0);
    const others = r.chargeLines.filter((l) => l.kind === "OTHER").sort((a, b) => a.sortOrder - b.sortOrder);
    const total = r.chargeLines.reduce((a, l) => a + num(l.total), 0);
    const paid = r.payments.reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0);
    const days = rentalDays(r.chargeLines);
    return {
      id: r.id,
      raNumber: r.raNumber,
      fullName: `${r.customer.firstName} ${r.customer.lastName}`,
      vehicle: `${r.vehicle.assignedId} ${r.vehicle.year ?? ""} ${r.vehicle.make.name} ${r.vehicle.model.name}`.replace(/\s+/g, " "),
      pickup: r.checkOutAt,
      dateIn: r.checkedInAt ?? r.expectedReturnAt,
      days,
      time: round(by("TIME")),
      discount: round(by("DISCOUNT")),
      mileage: round(by("MILEAGE")),
      fuel: round(by("FUEL", "PREPAID_FUEL")),
      upgrade: round(by("UPGRADE")),
      oneWay: round(by("ONE_WAY")),
      damage: round(by("DAMAGES")),
      company: r.company?.name ?? "",
      taxes: round(by("TAX")),
      ins: round(by("PROTECTION")),
      misc: round(by("MISC", "ADMIN")),
      adjust: round(r.adjustments.reduce((a, x) => a + num(x.amount), 0)),
      other: [0, 1, 2, 3].map((i) => round(num(others[i]?.total))),
      trafficTickets: round(by("TRAFFIC_TICKETS")),
      total: round(total),
      paid: round(paid),
      balance: round(total - paid),
    };
  });
  const sumRows = (k: keyof (typeof rows)[number]) => round(rows.reduce((a, r) => a + (r[k] as number), 0));
  const groupBy = (kind: string, nameOf: (l: RevenueRental["chargeLines"][number]) => string) => {
    const m = new Map<string, number>();
    for (const r of rentals) for (const l of r.chargeLines.filter((x) => x.kind === kind)) m.set(nameOf(l), (m.get(nameOf(l)) ?? 0) + num(l.total));
    const items = [...m.entries()].map(([name, amount]) => ({ name, amount: round(amount) })).sort((a, b) => a.name.localeCompare(b.name));
    return { items, total: round(items.reduce((a, x) => a + x.amount, 0)) };
  };
  const timeCharged = sumRows("time");
  const kmCharged = sumRows("mileage");
  // the built-in methods always listed (as RentCentric), then any location method used in the period
  const allPays = rentals.flatMap((r) => r.payments);
  const names = [...["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"].map((m) => methodLabel({ method: m })), ...new Set(allPays.filter((p) => p.method === "OTHER").map((p) => methodLabel(p)))];
  const paidBy = [...new Set(names)].map((name) => ({
    method: name,
    paid: round(allPays.filter((p) => methodLabel(p) === name).reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0)),
  }));
  return {
    rows,
    summary: {
      timeCharged,
      kmCharged,
      netTimeAndKm: round(timeCharged + kmCharged),
      misc: groupBy("MISC", (l) => l.miscCharge?.name ?? l.name),
      insurances: groupBy("PROTECTION", (l) => l.insurance?.name ?? l.name),
      taxes: groupBy("TAX", (l) => l.tax?.name ?? l.name),
      fuel: sumRows("fuel"),
      upgrade: sumRows("upgrade"),
      oneWay: sumRows("oneWay"),
      damages: sumRows("damage"),
      trafficTickets: sumRows("trafficTickets"),
      other: [0, 1, 2, 3].map((i) => round(rows.reduce((a, r) => a + r.other[i]!, 0))),
      discounts: sumRows("discount"),
      grandTotal: sumRows("total"),
      adjustments: sumRows("adjust"),
    },
    payments: {
      rentalCount: rows.length,
      totalDays: sumRows("days"),
      rentalsGrandTotal: sumRows("total"),
      accountsReceivable: sumRows("balance"),
      paidBy,
      totalPaid: round(paidBy.reduce((a, p) => a + p.paid, 0)),
    },
  };
}

const revenueSelect = {
  id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true,
  customer: { select: { firstName: true, lastName: true } }, company: { select: { name: true } },
  vehicle: { select: { assignedId: true, year: true, make: { select: { name: true } }, model: { select: { name: true } } } },
  chargeLines: { select: lineSelect }, payments: { select: { amount: true, transactionType: true, method: true, methodName: true } }, adjustments: { select: { amount: true } },
} satisfies Prisma.RentalSelect;

const locationFilters = {
  owningLocationId: optId,
  pickupLocationId: optId,
  returnLocationId: optId,
};
const locWhere = (i: { owningLocationId?: string; pickupLocationId?: string; returnLocationId?: string }): Prisma.RentalWhereInput => ({
  ...(i.owningLocationId ? { vehicle: { owningLocationId: i.owningLocationId } } : {}),
  ...(i.pickupLocationId ? { checkOutLocationId: i.pickupLocationId } : {}),
  ...(i.returnLocationId ? { checkInLocationId: i.returnLocationId } : {}),
});

/** One rental line for the revenue-by reports. */
const revenueRowSelect = {
  id: true, raNumber: true, status: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, odometerOut: true, odometerIn: true,
  customer: { select: { firstName: true, lastName: true } }, company: { select: { name: true } },
  vehicle: { select: { assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } }, vehicleType: { select: { name: true } },
  checkOutLocation: { select: { name: true } }, checkInLocation: { select: { name: true } },
  chargeLines: { select: { kind: true, name: true, units: true, total: true } },
  payments: { select: { amount: true, transactionType: true } },
  commissions: { select: { amount: true } },
} satisfies Prisma.RentalSelect;
type RevenueRowRental = Prisma.RentalGetPayload<{ select: typeof revenueRowSelect }>;

function revenueRow(r: RevenueRowRental) {
  const by = (...k: string[]) => r.chargeLines.filter((l) => k.includes(l.kind)).reduce((a, l) => a + num(l.total), 0);
  const total = r.chargeLines.reduce((a, l) => a + num(l.total), 0);
  const paid = r.payments.reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0);
  return {
    id: r.id, raNumber: r.raNumber, status: r.status,
    customer: `${r.customer.firstName} ${r.customer.lastName}`, firstName: r.customer.firstName, lastName: r.customer.lastName,
    company: r.company?.name ?? "", vehicleId: r.vehicle.assignedId, model: `${r.vehicle.make.name} ${r.vehicle.model.name}`, vehicleType: r.vehicleType.name,
    pickup: r.checkOutAt, returnDate: r.checkedInAt ?? r.expectedReturnAt, odOut: r.odometerOut, odIn: r.odometerIn,
    locOut: r.checkOutLocation.name, locIn: r.checkInLocation.name, days: rentalDays(r.chargeLines),
    time: round(by("TIME")), mileage: round(by("MILEAGE")), fuel: round(by("FUEL", "PREPAID_FUEL")),
    insurance: round(by("PROTECTION")), misc: round(by("MISC", "ADMIN")),
    total: round(total), balance: round(total - paid), commission: round(r.commissions.reduce((a, c) => a + num(c.amount), 0)),
  };
}
type RevenueRow = ReturnType<typeof revenueRow>;

/** Rows grouped under a heading (customer, vehicle, location), with subtotals and a grand total. */
function group(rows: RevenueRow[], key: (r: RevenueRow) => string) {
  const m = new Map<string, RevenueRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  const sum = (xs: RevenueRow[], k: "total" | "balance" | "time" | "mileage" | "fuel" | "insurance" | "misc") => round(xs.reduce((a, r) => a + r[k], 0));
  return {
    groups: [...m.entries()].map(([name, xs]) => ({ name, rows: xs, total: sum(xs, "total"), balance: sum(xs, "balance") })),
    count: rows.length,
    total: sum(rows, "total"),
    balance: sum(rows, "balance"),
  };
}

/** Pickup / date-in ranges and locations shared by the revenue-by reports (open and closed rentals). */
function revenueWhere(i: { pickupFrom?: Date; pickupTo?: Date; dateInFrom?: Date; dateInTo?: Date; locationId?: string; owningLocationId?: string }): Prisma.RentalWhereInput {
  return {
    deletedAt: null,
    status: { in: ["OPEN", "CLOSED"] },
    ...(range(i.pickupFrom, i.pickupTo) ? { checkOutAt: range(i.pickupFrom, i.pickupTo) } : {}),
    ...(range(i.dateInFrom, i.dateInTo) ? { checkedInAt: range(i.dateInFrom, i.dateInTo) } : {}),
    ...(i.locationId ? { checkOutLocationId: i.locationId } : {}),
    ...(i.owningLocationId ? { vehicle: { owningLocationId: i.owningLocationId } } : {}),
  };
}

/** Vehicle filters shared by the fleet reports. */
function vehicleFilter(i: { makeId?: string; assignedId?: string; year?: number; locationId?: string; vehicleTypeId?: string }): Prisma.VehicleWhereInput {
  return {
    ...(i.makeId ? { makeId: i.makeId } : {}),
    ...(i.assignedId ? { assignedId: { contains: i.assignedId, mode: "insensitive" } } : {}),
    ...(i.year ? { year: i.year } : {}),
    ...(i.locationId ? { rentalLocationId: i.locationId } : {}),
    ...(i.vehicleTypeId ? { vehicleTypeId: i.vehicleTypeId } : {}),
  };
}

export const reportsRouter = router({
  /** Daily Business Report: closed rentals by close date (one day or a range ≤ 31 days) and/or return date. */
  dailyBusiness: staffProcedure
    .input(z.object({ closeDate: optDate, closeFrom: optDate, closeTo: optDate, returnFrom: optDate, returnTo: optDate, ...locationFilters }))
    .query(async ({ ctx, input }) => {
      within31(input.closeFrom, input.closeTo, "Rental close date range");
      within31(input.returnFrom, input.returnTo, "Return date range");
      const close = input.closeDate ? range(input.closeDate, input.closeDate) : range(input.closeFrom, input.closeTo);
      if (!close && !input.returnFrom && !input.returnTo) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a rental close date or a date range." });
      const rentals = await ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: "CLOSED", ...(close ? { checkedInAt: close } : {}), ...(input.returnFrom || input.returnTo ? { expectedReturnAt: range(input.returnFrom, input.returnTo) } : {}), ...locWhere(input) },
        orderBy: { raNumber: "asc" },
        select: revenueSelect,
      });
      return revenueReport(rentals);
    }),

  /** Month to Date: the same revenue summary for one month, by rental return month or close month. */
  monthToDate: staffProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Choose a month"), by: z.enum(["CLOSE", "RETURN"]).default("CLOSE"), ...locationFilters }))
    .query(async ({ ctx, input }) => {
      const [y, m] = input.month.split("-").map(Number) as [number, number];
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 1));
      const rentals = await ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: "CLOSED", ...(input.by === "CLOSE" ? { checkedInAt: { gte: from, lt: to } } : { expectedReturnAt: { gte: from, lt: to } }), ...locWhere(input) },
        orderBy: { raNumber: "asc" },
        select: revenueSelect,
      });
      return revenueReport(rentals);
    }),

  /** Daily Cash Summary: every payment taken in the period (≤ 31 days), on rentals and reservations. */
  dailyCash: staffProcedure
    .input(z.object({ date: optDate, from: optDate, to: optDate, ...locationFilters }))
    .query(async ({ ctx, input }) => {
      within31(input.from, input.to);
      const when = input.date ? range(input.date, input.date) : range(input.from, input.to);
      if (!when) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a date or a date range." });
      const rentalWhere = locWhere(input);
      const payments = await ctx.prisma.payment.findMany({
        where: {
          takenAt: when,
          OR: [
            { rental: { deletedAt: null, ...rentalWhere } },
            { rentalId: null, reservation: { deletedAt: null, ...(input.pickupLocationId ? { pickupLocationId: input.pickupLocationId } : {}), ...(input.returnLocationId ? { returnLocationId: input.returnLocationId } : {}) } },
          ],
        },
        orderBy: { takenAt: "asc" },
        include: {
          takenBy: { select: { name: true } },
          company: { select: { name: true } },
          rental: { select: { raNumber: true, checkOutAt: true, checkOutLocation: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } }, reservation: { select: { number: true, pickupAt: true } } } },
          reservation: { select: { number: true, pickupAt: true, firstName: true, lastName: true, pickupLocation: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } } } },
        },
      });
      const rows = payments.map((p) => {
        const sign = p.transactionType === "REFUND" ? -1 : 1;
        const c = p.rental?.customer ?? p.reservation?.customer;
        return {
          id: p.id,
          raNumber: p.rental?.raNumber ?? null,
          reservationNumber: p.rental?.reservation?.number ?? p.reservation?.number ?? null,
          fullName: c ? `${c.firstName} ${c.lastName}` : [p.reservation?.firstName, p.reservation?.lastName].filter(Boolean).join(" "),
          amount: round(sign * num(p.amount)),
          type: p.transactionType,
          method: methodLabel(p),
          date: p.takenAt,
          takenBy: p.takenBy?.name ?? "",
          raPickup: p.rental?.checkOutAt ?? null,
          resPickup: p.rental?.reservation?.pickupAt ?? p.reservation?.pickupAt ?? null,
          pickupLocation: p.rental?.checkOutLocation.name ?? p.reservation?.pickupLocation.name ?? "",
          company: p.company?.name ?? "",
        };
      });
      return { rows, grandTotal: round(rows.filter((r) => r.type !== "AUTHORIZATION").reduce((a, r) => a + r.amount, 0)) };
    }),

  /** Rental Status: rentals by pickup / return date, vehicle, locations and status. */
  rentalStatus: staffProcedure
    .input(z.object({ pickupFrom: optDate, pickupTo: optDate, returnFrom: optDate, returnTo: optDate, makeId: optId, vehicleTypeId: optId, status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL"), ...locationFilters }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          status: input.status === "ALL" ? { in: ["OPEN", "CLOSED"] } : input.status,
          ...(range(input.pickupFrom, input.pickupTo) ? { checkOutAt: range(input.pickupFrom, input.pickupTo) } : {}),
          ...(range(input.returnFrom, input.returnTo) ? { OR: [{ checkedInAt: range(input.returnFrom, input.returnTo) }, { checkedInAt: null, expectedReturnAt: range(input.returnFrom, input.returnTo) }] } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.makeId ? { vehicle: { makeId: input.makeId, ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}) } } : {}),
          ...locWhere({ ...input, owningLocationId: input.makeId ? undefined : input.owningLocationId }),
        },
        orderBy: { checkOutAt: "asc" },
        take: 2000,
        select: {
          id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, odometerOut: true, odometerIn: true,
          customer: { select: { firstName: true, lastName: true } },
          vehicle: { select: { assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } },
          checkOutLocation: { select: { name: true } }, checkInLocation: { select: { name: true } },
          chargeLines: { where: { kind: "TIME" }, select: { name: true, units: true } },
        },
      });
      return rentals.map((r) => ({
        id: r.id, raNumber: r.raNumber, vehicleId: r.vehicle.assignedId, model: `${r.vehicle.make.name} ${r.vehicle.model.name}`,
        firstName: r.customer.firstName, lastName: r.customer.lastName, pickup: r.checkOutAt, odOut: r.odometerOut, locOut: r.checkOutLocation.name,
        returnDate: r.checkedInAt ?? r.expectedReturnAt, odIn: r.odometerIn, locIn: r.checkInLocation.name,
        days: rentalDays(r.chargeLines.map((l) => ({ ...l, kind: "TIME" }))),
      }));
    }),

  /** Reservation Manifest: reservations by pickup / return / reservation date, vehicle and location; grouped and sorted. */
  reservationManifest: staffProcedure
    .input(z.object({
      pickupFrom: optDate, pickupTo: optDate, returnFrom: optDate, returnTo: optDate, createdFrom: optDate, createdTo: optDate,
      assignedId: z.string().trim().optional(), makeId: optId, vehicleStatus: optId, vehicleTypeId: optId, locationId: optId,
      enteredBy: z.string().trim().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          status: { in: ["TENTATIVE", "CONFIRMED"] },
          ...(range(input.pickupFrom, input.pickupTo) ? { pickupAt: range(input.pickupFrom, input.pickupTo) } : {}),
          ...(range(input.returnFrom, input.returnTo) ? { returnAt: range(input.returnFrom, input.returnTo) } : {}),
          ...(range(input.createdFrom, input.createdTo) ? { createdAt: range(input.createdFrom, input.createdTo) } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.locationId ? { locationId: input.locationId } : {}),
          ...(input.assignedId || input.makeId || input.vehicleStatus
            ? { vehicle: { ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}), ...(input.makeId ? { makeId: input.makeId } : {}), ...(input.vehicleStatus ? { status: input.vehicleStatus as never } : {}) } }
            : {}),
          ...(input.enteredBy ? { createdBy: { name: { contains: input.enteredBy, mode: "insensitive" } } } : {}),
        },
        orderBy: { pickupAt: "asc" },
        take: 2000,
        select: {
          id: true, number: true, pickupAt: true, returnAt: true, firstName: true, lastName: true, createdById: true,
          customer: { select: { firstName: true, lastName: true } }, company: { select: { name: true } },
          vehicle: { select: { assignedId: true } }, vehicleType: { select: { name: true } },
          location: { select: { name: true } }, pickupLocation: { select: { name: true } }, returnLocation: { select: { name: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id, number: r.number, vehicleId: r.vehicle?.assignedId ?? "", vehicleType: r.vehicleType.name, company: r.company?.name ?? "",
        fullName: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : [r.firstName, r.lastName].filter(Boolean).join(" "),
        pickup: r.pickupAt, locOut: r.pickupLocation.name, returnDate: r.returnAt, locIn: r.returnLocation.name, location: r.location.name, enteredById: r.createdById,
      }));
    }),

  /** Vehicle Due In: open rentals (or reservations) due back in a period. */
  vehicleDueIn: staffProcedure
    .input(z.object({ makeId: optId, assignedId: z.string().trim().optional(), returnFrom: optDate, returnTo: optDate, returnLocationId: optId, currentLocationId: optId, vehicleTypeId: optId, filterBy: z.enum(["RENTAL", "RESERVATION"]).default("RENTAL") }))
    .query(async ({ ctx, input }) => {
      const due = range(input.returnFrom, input.returnTo);
      const vehicle = {
        ...(input.makeId ? { makeId: input.makeId } : {}),
        ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" as const } } : {}),
        ...(input.currentLocationId ? { currentLocationId: input.currentLocationId } : {}),
      };
      if (input.filterBy === "RESERVATION") {
        const rows = await ctx.prisma.reservation.findMany({
          where: {
            deletedAt: null, status: { in: ["TENTATIVE", "CONFIRMED"] }, ...(due ? { returnAt: due } : {}),
            ...(input.returnLocationId ? { returnLocationId: input.returnLocationId } : {}), ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
            ...(Object.keys(vehicle).length ? { vehicle } : {}),
          },
          orderBy: { returnAt: "asc" },
          take: 2000,
          select: { id: true, number: true, pickupAt: true, returnAt: true, firstName: true, lastName: true, phone: true, customer: { select: { firstName: true, lastName: true, phone: true } }, company: { select: { name: true } }, vehicle: { select: { assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } }, vehicleType: { select: { name: true } }, pickupLocation: { select: { name: true } } },
        });
        return rows.map((r) => ({
          id: r.id, kind: "RESERVATION" as const, number: r.number, firstName: r.customer?.firstName ?? r.firstName ?? "", lastName: r.customer?.lastName ?? r.lastName ?? "",
          phone: r.customer?.phone ?? r.phone ?? "", vehicleId: r.vehicle?.assignedId ?? "", model: r.vehicle ? `${r.vehicle.make.name} ${r.vehicle.model.name}` : r.vehicleType.name,
          company: r.company?.name ?? "", pickup: r.pickupAt, locOut: r.pickupLocation.name, expectedReturn: r.returnAt,
        }));
      }
      const rows = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null, status: "OPEN", ...(due ? { expectedReturnAt: due } : {}),
          ...(input.returnLocationId ? { checkInLocationId: input.returnLocationId } : {}), ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(Object.keys(vehicle).length ? { vehicle } : {}),
        },
        orderBy: { expectedReturnAt: "asc" },
        take: 2000,
        select: { id: true, raNumber: true, checkOutAt: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true, phone: true } }, company: { select: { name: true } }, vehicle: { select: { assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } }, checkOutLocation: { select: { name: true } } },
      });
      return rows.map((r) => ({
        id: r.id, kind: "RENTAL" as const, number: r.raNumber, firstName: r.customer.firstName, lastName: r.customer.lastName, phone: r.customer.phone ?? "",
        vehicleId: r.vehicle.assignedId, model: `${r.vehicle.make.name} ${r.vehicle.model.name}`, company: r.company?.name ?? "",
        pickup: r.checkOutAt, locOut: r.checkOutLocation.name, expectedReturn: r.expectedReturnAt,
      }));
    }),

  /** Revenue By Customer (ReportsCustomerRevenue): rentals grouped by customer. */
  revenueByCustomer: staffProcedure
    .input(z.object({ pickupFrom: optDate, pickupTo: optDate, dateInFrom: optDate, dateInTo: optDate, firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), locationId: optId, owningLocationId: optId, status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          ...revenueWhere(input),
          ...(input.status !== "ALL" ? { status: input.status } : {}),
          ...(input.firstName || input.lastName ? { customer: { ...(input.firstName ? { firstName: { contains: input.firstName, mode: "insensitive" } } : {}), ...(input.lastName ? { lastName: { contains: input.lastName, mode: "insensitive" } } : {}) } } : {}),
        },
        orderBy: [{ customer: { lastName: "asc" } }, { checkOutAt: "asc" }],
        take: 3000,
        select: revenueRowSelect,
      });
      return group(rentals.map(revenueRow), (r) => r.customer);
    }),

  /** Revenue By Vehicle (ReportsVehicleRevenue): rentals grouped by vehicle. */
  revenueByVehicle: staffProcedure
    .input(z.object({ assignedId: z.string().trim().optional(), makeId: optId, year: z.coerce.number().int().optional(), pickupFrom: optDate, pickupTo: optDate, dateInFrom: optDate, dateInTo: optDate, customer: z.string().trim().optional(), locationId: optId, vehicleTypeId: optId, vehicleStatus: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          ...revenueWhere(input),
          vehicle: {
            ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}),
            ...(input.makeId ? { makeId: input.makeId } : {}),
            ...(input.year ? { year: input.year } : {}),
            ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
            ...(input.vehicleStatus !== "ALL" ? { isActive: input.vehicleStatus === "ACTIVE" } : {}),
          },
          ...(input.customer ? { customer: { OR: [{ firstName: { contains: input.customer, mode: "insensitive" } }, { lastName: { contains: input.customer, mode: "insensitive" } }] } } : {}),
        },
        orderBy: [{ vehicle: { assignedId: "asc" } }, { checkOutAt: "asc" }],
        take: 3000,
        select: revenueRowSelect,
      });
      return group(rentals.map(revenueRow), (r) => `${r.vehicleId} · ${r.model}`);
    }),

  /** Revenue By Location (ReportsLocationRevenue): rentals grouped by pickup location. */
  revenueByLocation: staffProcedure
    .input(z.object({ pickupFrom: optDate, pickupTo: optDate, returnFrom: optDate, returnTo: optDate }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: { ...revenueWhere({ pickupFrom: input.pickupFrom, pickupTo: input.pickupTo, dateInFrom: input.returnFrom, dateInTo: input.returnTo }) },
        orderBy: [{ checkOutLocation: { name: "asc" } }, { checkOutAt: "asc" }],
        take: 3000,
        select: revenueRowSelect,
      });
      return group(rentals.map(revenueRow), (r) => r.locOut);
    }),

  /** Revenue By Company (ReportsRevenueByCompany): company rentals by close (return) date; Full Report or Commission. */
  revenueByCompany: staffProcedure
    .input(z.object({ companyId: optId, returnFrom: optDate, returnTo: optDate, mode: z.enum(["FULL", "COMMISSION"]).default("FULL") }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          status: { in: ["OPEN", "CLOSED"] },
          companyId: input.companyId ?? { not: null },
          ...(range(input.returnFrom, input.returnTo) ? { checkedInAt: range(input.returnFrom, input.returnTo) } : {}),
          ...(input.mode === "COMMISSION" ? { commissions: { some: {} } } : {}),
        },
        orderBy: [{ company: { name: "asc" } }, { checkOutAt: "asc" }],
        take: 3000,
        select: revenueRowSelect,
      });
      const rows = rentals.map(revenueRow);
      return { rows, total: round(rows.reduce((a, r) => a + r.total, 0)), commission: round(rows.reduce((a, r) => a + r.commission, 0)) };
    }),

  /** Vehicles Summary (ReportsVehicleList): vehicles by make / model / ID / year / status / owning location / type, grouped. */
  vehiclesSummary: staffProcedure
    .input(z.object({ makeId: optId, assignedId: z.string().trim().optional(), year: z.coerce.number().int().optional(), status: optId, owningLocationId: optId, vehicleTypeId: optId, groupBy: z.enum(["NONE", "MAKE", "MODEL", "YEAR", "STATUS", "TYPE", "LOCATION"]).default("LOCATION") }))
    .query(async ({ ctx, input }) => {
      const vs = await ctx.prisma.vehicle.findMany({
        where: {
          isActive: true,
          ...(input.makeId ? { makeId: input.makeId } : {}),
          ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}),
          ...(input.year ? { year: input.year } : {}),
          ...(input.status ? { status: input.status as never } : {}),
          ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
        },
        orderBy: { assignedId: "asc" },
        select: { id: true, assignedId: true, year: true, currentOdometer: true, fuelLevel: true, tankSize: true, vin: true, licenseNumber: true, status: true, make: { select: { name: true } }, model: { select: { name: true } }, vehicleType: { select: { name: true } }, owningLocation: { select: { name: true } }, currentLocation: { select: { name: true } }, rentalLocation: { select: { name: true } } },
      });
      const rows = vs.map((v) => ({ id: v.id, vehicleId: v.assignedId, currentLocation: (v.currentLocation ?? v.rentalLocation).name, type: v.vehicleType.name, year: v.year, odometer: v.currentOdometer, fuel: v.fuelLevel, tankSize: v.tankSize, make: v.make.name, model: v.model.name, vin: v.vin ?? "", plate: v.licenseNumber, status: v.status, owning: v.owningLocation.name }));
      const key = (r: (typeof rows)[number]) => ({ NONE: "", MAKE: r.make, MODEL: `${r.make} ${r.model}`, YEAR: String(r.year ?? ""), STATUS: r.status, TYPE: r.type, LOCATION: r.owning })[input.groupBy];
      const m = new Map<string, typeof rows>();
      for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
      return { groups: [...m.entries()].map(([name, rows]) => ({ name, rows })), count: rows.length };
    }),

  /** Vehicle License Expiration (ReportsVehicleLicenseExpiration). */
  licenseExpiration: staffProcedure
    .input(z.object({ makeId: optId, assignedId: z.string().trim().optional(), from: optDate, to: optDate, year: z.coerce.number().int().optional(), owningLocationId: optId, vehicleTypeId: optId, licenseProvince: z.string().trim().optional() }))
    .query(({ ctx, input }) =>
      ctx.prisma.vehicle
        .findMany({
          where: {
            isActive: true,
            licenseExpiry: range(input.from, input.to) ?? { not: null },
            ...(input.makeId ? { makeId: input.makeId } : {}),
            ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}),
            ...(input.year ? { year: input.year } : {}),
            ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}),
            ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
            ...(input.licenseProvince ? { licenseProvince: input.licenseProvince } : {}),
          },
          orderBy: { licenseExpiry: "asc" },
          select: { id: true, assignedId: true, licenseNumber: true, licenseExpiry: true, licenseProvince: true, make: { select: { name: true } }, model: { select: { name: true } }, vehicleType: { select: { name: true } } },
        })
        .then((vs) => vs.map((v) => ({ id: v.id, vehicleId: v.assignedId, make: v.make.name, model: v.model.name, type: v.vehicleType.name, plate: v.licenseNumber, state: v.licenseProvince ?? "", expires: v.licenseExpiry }))),
    ),

  /** Maintenance Alert (ReportsVehicleMaintanaceAlert): last service, interval, next service and km to go per vehicle. */
  maintenanceAlert: staffProcedure
    .input(z.object({ assignedId: z.string().trim().optional(), makeId: optId, year: z.coerce.number().int().optional(), owningLocationId: optId, vehicleTypeId: optId, status: optId }))
    .query(async ({ ctx, input }) => {
      const vs = await ctx.prisma.vehicle.findMany({
        where: {
          isActive: true,
          ...(input.assignedId ? { assignedId: { contains: input.assignedId, mode: "insensitive" } } : {}),
          ...(input.makeId ? { makeId: input.makeId } : {}),
          ...(input.year ? { year: input.year } : {}),
          ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.status ? { status: input.status as never } : {}),
        },
        orderBy: { assignedId: "asc" },
        select: {
          id: true, assignedId: true, licenseNumber: true, status: true, currentOdometer: true, maintenanceBeginOdometer: true, maintenanceEveryKm: true,
          make: { select: { name: true } }, model: { select: { name: true } }, vehicleType: { select: { name: true } }, currentLocation: { select: { name: true } }, rentalLocation: { select: { name: true } },
          maintenances: { orderBy: { date: "desc" }, take: 1, select: { date: true, odometer: true, nextDate: true, nextOdometer: true } },
        },
      });
      return vs.map((v) => {
        const last = v.maintenances[0];
        const lastKm = last?.odometer ?? v.maintenanceBeginOdometer ?? 0;
        const nextKm = last?.nextOdometer ?? (v.maintenanceEveryKm ? lastKm + v.maintenanceEveryKm : null);
        return {
          id: v.id, vehicleId: v.assignedId, plate: v.licenseNumber, currentLocation: (v.currentLocation ?? v.rentalLocation).name, status: v.status,
          model: `${v.make.name} ${v.model.name}`, type: v.vehicleType.name, odometer: v.currentOdometer, lastService: last?.date ?? null,
          interval: v.maintenanceEveryKm, nextServiceDate: last?.nextDate ?? null, kmToNext: nextKm != null && v.currentOdometer != null ? nextKm - v.currentOdometer : null,
        };
      });
    }),

  /** Customer List (ReportsCustomerList). */
  customerList: staffProcedure
    .input(z.object({ firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), city: z.string().trim().optional(), address: z.string().trim().optional(), phone: z.string().trim().optional(), postal: z.string().trim().optional(), locationId: optId, active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"), undesiredOnly: z.boolean().default(false) }))
    .query(({ ctx, input }) => {
      const has = (v?: string) => (v ? { contains: v, mode: "insensitive" as const } : undefined);
      return ctx.prisma.customer
        .findMany({
          where: {
            ...(input.firstName ? { firstName: has(input.firstName) } : {}),
            ...(input.lastName ? { lastName: has(input.lastName) } : {}),
            ...(input.city ? { city: has(input.city) } : {}),
            ...(input.address ? { address1: has(input.address) } : {}),
            ...(input.phone ? { phone: has(input.phone) } : {}),
            ...(input.postal ? { postal: has(input.postal) } : {}),
            ...(input.locationId ? { OR: [{ enteredLocationId: input.locationId }, { defaultLocationId: input.locationId }] } : {}),
            ...(input.active !== "ALL" ? { isActive: input.active === "ACTIVE" } : {}),
            ...(input.undesiredOnly ? { isUndesired: true } : {}),
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: 5000,
          select: { id: true, legacyId: true, firstName: true, lastName: true, isActive: true, address1: true, city: true, phone: true, licenseNumber: true, country: true, email: true, unsubscribedFromMarketing: true, createdAt: true, postal: true, company: { select: { name: true } }, enteredLocation: { select: { name: true } } },
        })
        .then((cs) => cs.map((c) => ({ ...c, customerId: c.legacyId ?? null, company: c.company?.name ?? "", location: c.enteredLocation?.name ?? "" })));
    }),

  /** Traffic Tickets (ReportsTrafficTickets). */
  trafficTickets: staffProcedure
    .input(z.object({ from: optDate, to: optDate, firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), city: z.string().trim().optional(), amount: z.coerce.number().optional(), locationId: optId }))
    .query(({ ctx, input }) =>
      ctx.prisma.trafficTicket
        .findMany({
          where: {
            ...(range(input.from, input.to) ? { ticketDate: range(input.from, input.to) } : {}),
            ...(input.city ? { city: { contains: input.city, mode: "insensitive" } } : {}),
            ...(input.amount != null && !Number.isNaN(input.amount) ? { amount: input.amount } : {}),
            rental: {
              deletedAt: null,
              ...(input.locationId ? { checkOutLocationId: input.locationId } : {}),
              ...(input.firstName || input.lastName ? { customer: { ...(input.firstName ? { firstName: { contains: input.firstName, mode: "insensitive" } } : {}), ...(input.lastName ? { lastName: { contains: input.lastName, mode: "insensitive" } } : {}) } } : {}),
            },
          },
          orderBy: { ticketDate: "desc" },
          take: 3000,
          select: { id: true, ticketDate: true, offense: true, amount: true, location: true, city: true, isPaid: true, rental: { select: { id: true, raNumber: true, customer: { select: { firstName: true, lastName: true } } } } },
        })
        .then((ts) => ts.map((t) => ({ id: t.id, rentalId: t.rental.id, raNumber: t.rental.raNumber, firstName: t.rental.customer.firstName, lastName: t.rental.customer.lastName, date: t.ticketDate, description: t.offense, amount: num(t.amount), location: [t.location, t.city].filter(Boolean).join(", "), isPaid: t.isPaid }))),
    ),

  /** Vehicle Maintenance (ReportsVehicleMaintanace): maintenance entries by date, vehicle and location. */
  vehicleMaintenance: staffProcedure
    .input(z.object({ from: optDate, to: optDate, makeId: optId, assignedId: z.string().trim().optional(), year: z.coerce.number().int().optional(), locationId: optId, vehicleTypeId: optId }))
    .query(({ ctx, input }) =>
      ctx.prisma.vehicleMaintenance
        .findMany({
          where: { ...(range(input.from, input.to) ? { date: range(input.from, input.to) } : {}), vehicle: vehicleFilter(input) },
          orderBy: [{ vehicle: { assignedId: "asc" } }, { date: "asc" }],
          take: 3000,
          select: { id: true, date: true, type: true, odometer: true, shop: true, poNumber: true, paymentMethod: true, paymentAmount: true, partsCost: true, labourCost: true, vehicle: { select: { id: true, assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } } },
        })
        .then((ms) => ms.map((m) => ({ id: m.id, vehicleRowId: m.vehicle.id, vehicleId: m.vehicle.assignedId, date: m.date, type: m.type ?? "", make: m.vehicle.make.name, model: m.vehicle.model.name, odometer: m.odometer, shop: m.shop ?? "", po: m.poNumber ?? "", paymentType: m.paymentMethod ? methodLabel({ method: m.paymentMethod }) : "", paymentAmount: num(m.paymentAmount), parts: num(m.partsCost), labour: num(m.labourCost) }))),
    ),

  /** Vehicle Repairs (ReportsVehicleRepairs): repairs by repair date, vehicle and owning location. */
  vehicleRepairs: staffProcedure
    .input(z.object({ from: optDate, to: optDate, makeId: optId, assignedId: z.string().trim().optional(), owningLocationId: optId, vehicleTypeId: optId }))
    .query(({ ctx, input }) =>
      ctx.prisma.vehicleRepair
        .findMany({
          where: { ...(range(input.from, input.to) ? { date: range(input.from, input.to) } : {}), vehicle: { ...vehicleFilter(input), ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}) } },
          orderBy: [{ vehicle: { assignedId: "asc" } }, { date: "asc" }],
          take: 3000,
          select: { id: true, date: true, shopName: true, totalParts: true, totalLabour: true, odometerOut: true, odometerIn: true, description: true, vehicle: { select: { id: true, assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } } },
        })
        .then((rs) => rs.map((r) => ({ id: r.id, vehicleRowId: r.vehicle.id, vehicleId: r.vehicle.assignedId, make: r.vehicle.make.name, model: r.vehicle.model.name, date: r.date, shop: r.shopName ?? "", part: num(r.totalParts), labour: num(r.totalLabour), kmOut: r.odometerOut, kmIn: r.odometerIn, description: r.description ?? "" }))),
    ),

  /** Source Of Referral ("Revenue By Referrals", ReportsReferral): rentals grouped by referral. */
  sourceOfReferral: staffProcedure
    .input(z.object({ referralId: optId, from: optDate, to: optDate, owningLocationId: optId, vehicleTypeId: optId }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null, status: { in: ["OPEN", "CLOSED"] },
          referralId: input.referralId ?? { not: null },
          ...(range(input.from, input.to) ? { checkOutAt: range(input.from, input.to) } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.owningLocationId ? { vehicle: { owningLocationId: input.owningLocationId } } : {}),
        },
        orderBy: [{ referral: { name: "asc" } }, { checkOutAt: "asc" }],
        take: 3000,
        select: { ...revenueRowSelect, reservation: { select: { number: true } }, referral: { select: { name: true } } },
      });
      return group(
        rentals.map((r) => ({ ...revenueRow(r), reservationNumber: r.reservation?.number ?? null, referral: r.referral?.name ?? "", expectedReturn: r.expectedReturnAt })),
        (r) => (r as RevenueRow & { referral: string }).referral,
      );
    }),

  /** Customer By Region (ReportsCustomerByRegion): customers grouped by area / region. */
  customerByRegion: staffProcedure
    .input(z.object({ firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), city: z.string().trim().optional(), phone: z.string().trim().optional(), regionId: optId }))
    .query(async ({ ctx, input }) => {
      const has = (v?: string) => (v ? { contains: v, mode: "insensitive" as const } : undefined);
      const cs = await ctx.prisma.customer.findMany({
        where: {
          ...(input.firstName ? { firstName: has(input.firstName) } : {}),
          ...(input.lastName ? { lastName: has(input.lastName) } : {}),
          ...(input.city ? { city: has(input.city) } : {}),
          ...(input.phone ? { phone: has(input.phone) } : {}),
          ...(input.regionId ? { regionId: input.regionId } : {}),
        },
        orderBy: [{ region: { name: "asc" } }, { lastName: "asc" }],
        take: 5000,
        select: { id: true, legacyId: true, firstName: true, lastName: true, address1: true, city: true, phone: true, region: { select: { name: true } } },
      });
      const m = new Map<string, typeof cs>();
      for (const c of cs) m.set(c.region?.name ?? "No region", [...(m.get(c.region?.name ?? "No region") ?? []), c]);
      return { groups: [...m.entries()].map(([name, rows]) => ({ name, rows })), count: cs.length };
    }),

  /** Payments & Charges (ReportsTransactions): every transaction, grouped by payment method. */
  paymentsAndCharges: staffProcedure
    .input(z.object({ from: optDate, to: optDate, method: z.string().optional(), type: z.enum(["ALL", "PAYMENT", "AUTHORIZATION", "REFUND"]).default("PAYMENT"), firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), authorizationCode: z.string().trim().optional(), transactionCode: z.string().trim().optional(), amount: z.coerce.number().optional(), raNumber: z.coerce.number().int().optional(), reservationNumber: z.coerce.number().int().optional(), takenBy: z.string().trim().optional(), locationId: optId }))
    .query(async ({ ctx, input }) => {
      const name = input.firstName || input.lastName ? { ...(input.firstName ? { firstName: { contains: input.firstName, mode: "insensitive" as const } } : {}), ...(input.lastName ? { lastName: { contains: input.lastName, mode: "insensitive" as const } } : {}) } : null;
      const ps = await ctx.prisma.payment.findMany({
        where: {
          ...(range(input.from, input.to) ? { takenAt: range(input.from, input.to) } : {}),
          ...(input.method ? methodData(input.method).method === "OTHER" ? { method: "OTHER", methodName: input.method.slice(6) } : { method: methodData(input.method).method } : {}),
          ...(input.type !== "ALL" ? { transactionType: input.type } : {}),
          ...(input.authorizationCode ? { authorizationCode: { contains: input.authorizationCode, mode: "insensitive" } } : {}),
          ...(input.transactionCode ? { transactionCode: { contains: input.transactionCode, mode: "insensitive" } } : {}),
          ...(input.amount != null && !Number.isNaN(input.amount) ? { amount: input.amount } : {}),
          ...(input.raNumber ? { rental: { raNumber: input.raNumber } } : {}),
          ...(input.reservationNumber ? { reservation: { number: input.reservationNumber } } : {}),
          ...(input.takenBy ? { takenBy: { name: { contains: input.takenBy, mode: "insensitive" } } } : {}),
          ...(name ? { customer: name } : {}),
          ...(input.locationId ? { OR: [{ rental: { checkOutLocationId: input.locationId } }, { rentalId: null, reservation: { pickupLocationId: input.locationId } }] } : {}),
        },
        orderBy: [{ method: "asc" }, { takenAt: "asc" }],
        take: 5000,
        include: { takenBy: { select: { name: true } }, customer: { select: { firstName: true, lastName: true } }, rental: { select: { id: true, raNumber: true } }, reservation: { select: { id: true, number: true } } },
      });
      const rows = ps.map((p) => ({
        id: p.id, method: methodLabel(p), date: p.takenAt, details: [p.paymentDetail, p.paymentDetailCont].filter(Boolean).join(" "),
        raNumber: p.rental?.raNumber ?? null, rentalId: p.rental?.id ?? null, reservationNumber: p.reservation?.number ?? null, reservationId: p.reservation?.id ?? null,
        customer: p.customer ? `${p.customer.firstName} ${p.customer.lastName}` : "", takenBy: p.takenBy?.name ?? "", cardNo: p.cardLast4 ? `XXXX${p.cardLast4}` : "",
        authorizationCode: p.authorizationCode ?? "", transactionCode: p.transactionCode ?? "", amount: round((p.transactionType === "REFUND" ? -1 : 1) * num(p.amount)), type: p.transactionType,
      }));
      const m = new Map<string, typeof rows>();
      for (const r of rows) m.set(r.method, [...(m.get(r.method) ?? []), r]);
      return { groups: [...m.entries()].map(([name, xs]) => ({ name, rows: xs, total: round(xs.reduce((a, x) => a + x.amount, 0)) })), total: round(rows.reduce((a, x) => a + x.amount, 0)), count: rows.length };
    }),

  /** Reservations No Showup/Cancelled (ReportsReservationsNoShowCancelled). */
  noShowCancelled: staffProcedure
    .input(z.object({ pickupFrom: optDate, pickupTo: optDate, returnFrom: optDate, returnTo: optDate, createdFrom: optDate, createdTo: optDate, makeId: optId, vehicleTypeId: optId, locationId: optId, pickupLocationId: optId, returnLocationId: optId, status: z.enum(["ALL", "NO_SHOW", "CANCELLED"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const rs = await ctx.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          status: input.status === "ALL" ? { in: ["NO_SHOW", "CANCELLED"] } : input.status,
          ...(range(input.pickupFrom, input.pickupTo) ? { pickupAt: range(input.pickupFrom, input.pickupTo) } : {}),
          ...(range(input.returnFrom, input.returnTo) ? { returnAt: range(input.returnFrom, input.returnTo) } : {}),
          ...(range(input.createdFrom, input.createdTo) ? { createdAt: range(input.createdFrom, input.createdTo) } : {}),
          ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
          ...(input.makeId ? { vehicle: { makeId: input.makeId } } : {}),
          ...(input.locationId ? { locationId: input.locationId } : {}),
          ...(input.pickupLocationId ? { pickupLocationId: input.pickupLocationId } : {}),
          ...(input.returnLocationId ? { returnLocationId: input.returnLocationId } : {}),
        },
        orderBy: { pickupAt: "asc" },
        take: 3000,
        select: {
          id: true, number: true, status: true, createdAt: true, pickupAt: true, returnAt: true, firstName: true, lastName: true,
          customer: { select: { firstName: true, lastName: true } }, vehicleType: { select: { name: true } }, pickupLocation: { select: { name: true } },
          chargeLines: { select: { kind: true, total: true } }, payments: { select: { amount: true, transactionType: true } },
          memos: { where: { body: { startsWith: "Cancelled" } }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, author: { select: { name: true } } } },
        },
      });
      return rs.map((r) => {
        const by = (...k: string[]) => round(r.chargeLines.filter((l) => k.includes(l.kind)).reduce((a, l) => a + num(l.total), 0));
        const memo = r.memos[0];
        return {
          id: r.id, number: r.number, status: r.status, customer: r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : [r.firstName, r.lastName].filter(Boolean).join(" "),
          reservationDate: r.createdAt, vehicleType: r.vehicleType.name, checkout: r.pickupAt, checkoutLocation: r.pickupLocation.name, checkIn: r.returnAt,
          netRate: by("TIME", "MILEAGE", "DISCOUNT", "UPGRADE"), insurances: by("PROTECTION"), taxes: by("TAX"), misc: by("MISC", "ADMIN", "OTHER"), oneWay: by("ONE_WAY"),
          total: round(r.chargeLines.reduce((a, l) => a + num(l.total), 0)),
          paid: round(r.payments.reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0)),
          cancelledBy: memo?.author?.name ?? "", reason: memo ? memo.body.replace(/^Cancelled:\s*/, "") : r.status === "NO_SHOW" ? "No show" : "",
        };
      });
    }),

  /** Tasks (ReportsTasks): tasks dated in the range, with who entered them and who they were sent to. */
  tasks: staffProcedure
    .input(z.object({ from: optDate, to: optDate, subject: z.string().trim().optional(), description: z.string().trim().optional() }))
    .query(async ({ ctx, input }) => {
      const ts = await ctx.prisma.task.findMany({
        where: {
          ...(range(input.from, input.to) ? { date: range(input.from, input.to) } : {}),
          ...(input.subject ? { subject: { contains: input.subject, mode: "insensitive" } } : {}),
          ...(input.description ? { description: { contains: input.description, mode: "insensitive" } } : {}),
        },
        orderBy: { date: "asc" },
        take: 3000,
        select: { id: true, date: true, subject: true, status: true, priority: true, enteredById: true, updatedAt: true, assignees: { select: { userId: true } } },
      });
      const ids = [...new Set(ts.flatMap((t) => [t.enteredById, ...t.assignees.map((a) => a.userId)]).filter((x): x is string => !!x))];
      const users = new Map((await ctx.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      return ts.map((t) => ({
        id: t.id, dateEntered: t.date, dateClosed: t.status === "CLOSED" ? t.updatedAt : null, enteredBy: (t.enteredById && users.get(t.enteredById)) ?? "",
        sentTo: t.assignees.map((a) => users.get(a.userId) ?? "").filter(Boolean).join(", "), status: t.status, priority: t.priority, subject: t.subject,
      }));
    }),

  /**
   * Consolidated Commission Report (ReportsCommissionsLog): per rental, what the Reservation / Open / Close / Walk-in agents
   * earn from their Commission Structures (rentals opened in the range), plus commissions entered on the rental (entered in
   * the range; counted under the role their earner had on the rental, otherwise Walk In).
   */
  commissions: staffProcedure
    .input(z.object({ from: optDate, to: optDate, locationId: optId, agentId: optId }))
    .query(async ({ ctx, input }) => {
      // agents with Commission Structures (Users form) earn on rentals opened in the period; commissions entered by hand count too
      const [agents, structures] = await Promise.all([
        ctx.prisma.user.findMany({ where: { commissionStructureIds: { isEmpty: false }, ...(input.agentId ? { id: input.agentId } : {}) }, select: { id: true, commissionStructureIds: true } }),
        ctx.prisma.commissionStructure.findMany({ select: { id: true, locationId: true, rules: true } }),
      ]);
      const agentIds = agents.map((a) => a.id);
      const when = range(input.from, input.to);
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          ...(input.locationId ? { checkOutLocationId: input.locationId } : {}),
          OR: [
            { commissions: { some: { ...(when ? { enteredAt: when } : {}), ...(input.agentId ? { userId: input.agentId } : {}) } } },
            ...(agentIds.length ? [{ ...(when ? { checkOutAt: when } : {}), OR: [{ openedById: { in: agentIds } }, { closedById: { in: agentIds } }, { reservation: { createdById: { in: agentIds } } }] }] : []),
          ],
        },
        orderBy: { raNumber: "asc" },
        take: 3000,
        select: {
          id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, openedById: true, closedById: true, checkOutLocationId: true,
          reservation: { select: { number: true, createdById: true } },
          vehicle: { select: { assignedId: true } },
          chargeLines: { select: { kind: true, name: true, units: true, total: true } },
          commissions: { where: { ...(when ? { enteredAt: when } : {}), ...(input.agentId ? { userId: input.agentId } : {}) }, select: { amount: true, userId: true } },
        },
      });
      const rulesFor = (userId: string | null | undefined, locationId: string) => {
        const a = userId ? agents.find((x) => x.id === userId) : undefined;
        if (!a) return [];
        return structures.filter((st) => a.commissionStructureIds.includes(st.id) && (!st.locationId || st.locationId === locationId)).map((st) => st.rules as Rules);
      };
      const rows = rentals.map((r) => {
        const by = (...k: string[]) => round(r.chargeLines.filter((l) => k.includes(l.kind)).reduce((a, l) => a + num(l.total), 0));
        const days = rentalDays(r.chargeLines);
        const lines = r.chargeLines.map((l) => ({ kind: l.kind, name: l.name, total: num(l.total) }));
        const role = (userId: string | null | undefined, rl: Role) => roleCommission(rulesFor(userId, r.checkOutLocationId), rl, lines, days);
        const walkIn = !r.reservation;
        const comm = {
          res: walkIn ? 0 : role(r.reservation?.createdById, "res"),
          open: role(r.openedById, "open"),
          close: r.checkedInAt ? role(r.closedById, "close") : 0,
          walkIn: walkIn ? role(r.openedById, "walkin") : 0,
        };
        // commissions entered on the rental (Commissions tab), by who earned them
        for (const c of r.commissions) {
          const k = c.userId && c.userId === r.reservation?.createdById ? "res" : c.userId && c.userId === r.openedById ? "open" : c.userId && c.userId === r.closedById ? "close" : "walkIn";
          comm[k] = round(comm[k] + num(c.amount));
        }
        return {
          id: r.id, raNumber: r.raNumber, reservationNumber: r.reservation?.number ?? null, pickup: r.checkOutAt, return: r.checkedInAt ?? r.expectedReturnAt,
          days, vehicle: r.vehicle.assignedId, tm: by("TIME", "MILEAGE"), total: round(r.chargeLines.reduce((a, l) => a + num(l.total), 0)), discount: by("DISCOUNT"),
          ...comm, totalComm: round(comm.res + comm.open + comm.close + comm.walkIn),
        };
      }).filter((r) => r.totalComm !== 0);
      const sum = (k: "tm" | "total" | "discount" | "res" | "open" | "close" | "walkIn" | "totalComm") => round(rows.reduce((a, r) => a + r[k], 0));
      return { rows, totals: { tm: sum("tm"), total: sum("total"), discount: sum("discount"), res: sum("res"), open: sum("open"), close: sum("close"), walkIn: sum("walkIn"), totalComm: sum("totalComm") } };
    }),

  /**
   * Adjustment Details (ReportsAdjustmentDetailsReport): rentals with adjustments. Adjust Paid is what was paid beyond
   * the rental's other charges (payments go to the original charges first).
   */
  adjustmentDetails: staffProcedure
    .input(z.object({ dateInFrom: optDate, dateInTo: optDate, adjustmentFrom: optDate, adjustmentTo: optDate, paymentFrom: optDate, paymentTo: optDate, locationOutId: optId, locationInId: optId }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          adjustments: { some: range(input.adjustmentFrom, input.adjustmentTo) ? { enteredAt: range(input.adjustmentFrom, input.adjustmentTo) } : {} },
          ...(range(input.dateInFrom, input.dateInTo) ? { checkedInAt: range(input.dateInFrom, input.dateInTo) } : {}),
          ...(range(input.paymentFrom, input.paymentTo) ? { payments: { some: { takenAt: range(input.paymentFrom, input.paymentTo) } } } : {}),
          ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
          ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
        },
        orderBy: { raNumber: "asc" },
        take: 3000,
        select: {
          id: true, raNumber: true, status: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true,
          customer: { select: { firstName: true, lastName: true } }, company: { select: { name: true } }, reservation: { select: { number: true } },
          vehicle: { select: { assignedId: true } }, openedBy: { select: { name: true } }, closedBy: { select: { name: true } },
          chargeLines: { select: { total: true } }, payments: { select: { amount: true, transactionType: true } }, adjustments: { select: { amount: true } },
        },
      });
      const rows = rentals.map((r) => {
        const adjust = round(r.adjustments.reduce((a, x) => a + num(x.amount), 0));
        const total = r.chargeLines.reduce((a, l) => a + num(l.total), 0);
        const paid = r.payments.reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0);
        const adjustPaid = round(Math.min(Math.max(adjust, 0), Math.max(0, paid - (total - adjust))));
        return {
          id: r.id, raNumber: r.raNumber, fullName: `${r.customer.firstName} ${r.customer.lastName}`, reservationNumber: r.reservation?.number ?? null, vehicle: r.vehicle.assignedId,
          pickup: r.checkOutAt, return: r.checkedInAt ?? r.expectedReturnAt, status: r.status, openedBy: r.openedBy?.name ?? "", closedBy: r.closedBy?.name ?? "", closeDate: r.checkedInAt,
          company: r.company?.name ?? "", adjustTotal: adjust, adjustPaid, adjustBalance: round(adjust - adjustPaid),
        };
      });
      const sum = (k: "adjustTotal" | "adjustPaid" | "adjustBalance") => round(rows.reduce((a, r) => a + r[k], 0));
      return { rows, totals: { adjustTotal: sum("adjustTotal"), adjustPaid: sum("adjustPaid"), adjustBalance: sum("adjustBalance") } };
    }),

  /** Rental Days Report (ReportsRentalDays): hours / days / weeks / months charged per rental and their rates. */
  rentalDays: staffProcedure
    .input(z.object({ from: optDate, to: optDate, dateInFrom: optDate, dateInTo: optDate, locationOutId: optId, locationInId: optId, status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          ...(input.status !== "ALL" ? { status: input.status } : {}),
          ...(range(input.from, input.to) ? { checkOutAt: range(input.from, input.to) } : {}),
          ...(range(input.dateInFrom, input.dateInTo) ? { OR: [{ checkedInAt: range(input.dateInFrom, input.dateInTo) }, { checkedInAt: null, expectedReturnAt: range(input.dateInFrom, input.dateInTo) }] } : {}),
          ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
          ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
        },
        orderBy: { raNumber: "asc" },
        take: 3000,
        select: {
          id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true,
          customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { assignedId: true } }, vehicleType: { select: { name: true } }, checkOutLocation: { select: { name: true } },
          chargeLines: { where: { kind: "TIME" }, select: { name: true, units: true, rate: true, total: true } },
        },
      });
      const rows = rentals.map((r) => {
        const part = (re: RegExp) => {
          const ls = r.chargeLines.filter((l) => re.test(l.name));
          return { units: round(ls.reduce((a, l) => a + num(l.units), 0)), rate: ls.length ? num(ls[0]!.rate) : 0 };
        };
        const h = part(/hour/i), d = part(/dai|day/i), w = part(/week/i), m = part(/month/i);
        return {
          id: r.id, raNumber: r.raNumber, fullName: `${r.customer.firstName} ${r.customer.lastName}`, vehicle: r.vehicle.assignedId, vehicleType: r.vehicleType.name, locationOut: r.checkOutLocation.name,
          dateOut: r.checkOutAt, dateIn: r.checkedInAt ?? r.expectedReturnAt, hours: h.units, hourlyRate: h.rate, daily: d.units, dailyRate: d.rate, weekly: w.units, weeklyRate: w.rate,
          monthly: m.units, monthlyRate: m.rate, total: round(r.chargeLines.reduce((a, l) => a + num(l.total), 0)),
        };
      });
      const sum = (k: "hours" | "daily" | "weekly" | "monthly" | "total") => round(rows.reduce((a, r) => a + r[k], 0));
      return { rows, totals: { hours: sum("hours"), daily: sum("daily"), weekly: sum("weekly"), monthly: sum("monthly"), total: sum("total") } };
    }),

  /** Rental Discount (ReportsRentalDiscount): discounts added, changed or removed on rentals (from the rental's change log). */
  rentalDiscount: staffProcedure
    .input(z.object({ from: optDate, to: optDate, locationOutId: optId, locationInId: optId, status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.prisma.auditLog.findMany({
        where: { entityType: "Rental", field: "Discount", ...(range(input.from, input.to) ? { at: range(input.from, input.to) } : {}) },
        orderBy: { at: "asc" },
        take: 5000,
        select: { id: true, entityId: true, oldValue: true, newValue: true, at: true, user: { select: { name: true } } },
      });
      const rentals = new Map(
        (
          await ctx.prisma.rental.findMany({
            where: {
              id: { in: [...new Set(logs.map((l) => l.entityId))] },
              deletedAt: null,
              ...(input.status !== "ALL" ? { status: input.status } : {}),
              ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
              ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
            },
            select: { id: true, raNumber: true, customer: { select: { firstName: true, lastName: true } } },
          })
        ).map((r) => [r.id, r]),
      );
      return logs.flatMap((l) => {
        const r = rentals.get(l.entityId);
        if (!r) return [];
        const action = !l.oldValue ? "Added" : !l.newValue ? "Removed" : "Changed";
        return [{ id: l.id, rentalId: r.id, raNumber: r.raNumber, customer: `${r.customer.firstName} ${r.customer.lastName}`, action, oldValue: l.oldValue ?? "", newValue: l.newValue ?? "", date: l.at, admin: l.user?.name ?? "" }];
      });
    }),

  /** Customer Notes (ReportsCustomerNotes): the customer's notes (memos), grouped by customer. */
  customerNotes: staffProcedure
    .input(z.object({ customerId: z.coerce.number().int().optional(), firstName: z.string().trim().optional(), lastName: z.string().trim().optional(), city: z.string().trim().optional(), address: z.string().trim().optional(), phone: z.string().trim().optional(), keyword: z.string().trim().optional(), locationId: optId }))
    .query(async ({ ctx, input }) => {
      const has = (v?: string) => (v ? { contains: v, mode: "insensitive" as const } : undefined);
      const memos = await ctx.prisma.memo.findMany({
        where: {
          customerId: { not: null },
          ...(input.keyword ? { body: has(input.keyword) } : {}),
          customer: {
            ...(input.customerId ? { legacyId: input.customerId } : {}),
            ...(input.firstName ? { firstName: has(input.firstName) } : {}),
            ...(input.lastName ? { lastName: has(input.lastName) } : {}),
            ...(input.city ? { city: has(input.city) } : {}),
            ...(input.address ? { address1: has(input.address) } : {}),
            ...(input.phone ? { phone: has(input.phone) } : {}),
            ...(input.locationId ? { OR: [{ enteredLocationId: input.locationId }, { defaultLocationId: input.locationId }] } : {}),
          },
        },
        orderBy: [{ customer: { lastName: "asc" } }, { createdAt: "asc" }],
        take: 5000,
        select: { id: true, body: true, createdAt: true, author: { select: { name: true } }, customer: { select: { id: true, legacyId: true, firstName: true, lastName: true, phone: true } } },
      });
      const m = new Map<string, { customerId: string; legacyId: number | null; name: string; phone: string; notes: { id: string; date: Date; by: string; note: string }[] }>();
      for (const x of memos) {
        const c = x.customer!;
        const g = m.get(c.id) ?? { customerId: c.id, legacyId: c.legacyId, name: `${c.firstName} ${c.lastName}`, phone: c.phone ?? "", notes: [] };
        g.notes.push({ id: x.id, date: x.createdAt, by: x.author?.name ?? "", note: x.body });
        m.set(c.id, g);
      }
      return { groups: [...m.values()], count: memos.length };
    }),

  /**
   * Promo Code (PromoCodeReport): reservations booked with a promo code (Usage = the reservation date): First / Last Name,
   * Promo Code, Res.#, Rental #, Pickup / Return Date, Res.Total, Rental Subtotal, Rental Total, Date, Discount, Discount Total.
   */
  promoCodes: staffProcedure
    .input(z.object({ from: optDate, to: optDate, locationIds: z.array(z.string()).default([]), category: z.enum(["", "RESERVATION", "REGISTRATION"]).default(""), code: z.string().trim().optional() }))
    .query(async ({ ctx, input }) => {
      const rs = await ctx.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          promoCodeId: { not: null },
          ...(range(input.from, input.to) ? { createdAt: range(input.from, input.to) } : {}),
          ...(input.locationIds.length ? { pickupLocationId: { in: input.locationIds } } : {}),
          promoCode: { ...(input.category ? { category: input.category } : {}), ...(input.code ? { code: { contains: input.code, mode: "insensitive" } } : {}) },
        },
        orderBy: { createdAt: "asc" },
        take: 3000,
        select: {
          id: true, number: true, createdAt: true, pickupAt: true, returnAt: true, firstName: true, lastName: true, discountType: true, discountValue: true,
          promoCode: { select: { code: true } }, chargeLines: { select: { kind: true, total: true } },
          rental: { select: { id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, chargeLines: { select: { kind: true, total: true } } } },
        },
      });
      const rows = rs.map((r) => {
        const tot = (ls: { kind: string; total: Prisma.Decimal }[]) => round(ls.reduce((a, l) => a + num(l.total), 0));
        const sub = (ls: { kind: string; total: Prisma.Decimal }[]) => round(ls.filter((l) => l.kind !== "TAX").reduce((a, l) => a + num(l.total), 0));
        const lines = r.rental?.chargeLines ?? r.chargeLines;
        return {
          id: r.id, firstName: r.firstName, lastName: r.lastName, code: r.promoCode!.code, reservationNumber: r.number, rentalId: r.rental?.id ?? null, raNumber: r.rental?.raNumber ?? null,
          pickup: r.rental?.checkOutAt ?? r.pickupAt, return: r.rental ? r.rental.checkedInAt ?? r.rental.expectedReturnAt : r.returnAt,
          resTotal: tot(r.chargeLines), rentalSubtotal: r.rental ? sub(r.rental.chargeLines) : null, rentalTotal: r.rental ? tot(r.rental.chargeLines) : null, date: r.createdAt,
          discount: r.discountValue == null ? "" : r.discountType === "PERCENT" ? `${num(r.discountValue)}%` : `$${num(r.discountValue).toFixed(2)}`,
          discountTotal: round(-lines.filter((l) => l.kind === "DISCOUNT").reduce((a, l) => a + num(l.total), 0)),
        };
      });
      return { rows, totals: { discountTotal: round(rows.reduce((a, r) => a + r.discountTotal, 0)) } };
    }),

  /**
   * Rental Details (ReportsRentalDetailsReport): per rental the customer, booking and every charge column (RA#, Customer ID,
   * names, phone, email, Res#, vehicle, type, locations, dates, status, opened / closed by, Days, Time … Balance), with a Total row.
   */
  rentalDetails: staffProcedure
    .input(z.object({ from: optDate, to: optDate, dateInFrom: optDate, dateInTo: optDate, locationOutId: optId, locationInId: optId, status: z.enum(["ALL", "OPEN", "CLOSED"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.RentalWhereInput = {
        deletedAt: null,
        ...(input.status !== "ALL" ? { status: input.status } : { status: { in: ["OPEN", "CLOSED"] } }),
        ...(range(input.from, input.to) ? { checkOutAt: range(input.from, input.to) } : {}),
        ...(range(input.dateInFrom, input.dateInTo) ? { checkedInAt: range(input.dateInFrom, input.dateInTo) } : {}),
        ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
        ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
      };
      const [money, extra] = await Promise.all([
        ctx.prisma.rental.findMany({ where, orderBy: { raNumber: "asc" }, take: 3000, select: revenueSelect }),
        ctx.prisma.rental.findMany({
          where, orderBy: { raNumber: "asc" }, take: 3000,
          select: {
            id: true, status: true, checkedInAt: true, invoices: { select: { amount: true } },
            customer: { select: { legacyId: true, firstName: true, lastName: true, phone: true, email: true } }, reservation: { select: { number: true } }, vehicleType: { select: { name: true } },
            checkOutLocation: { select: { name: true } }, checkInLocation: { select: { name: true } }, openedBy: { select: { name: true } }, closedBy: { select: { name: true } },
          },
        }),
      ]);
      const rep = revenueReport(money);
      const byId = new Map(extra.map((e) => [e.id, e]));
      const rows = rep.rows.map((r) => {
        const e = byId.get(r.id)!;
        return {
          ...r, customerId: e.customer.legacyId, firstName: e.customer.firstName, lastName: e.customer.lastName, phone: e.customer.phone ?? "", email: e.customer.email ?? "",
          reservationNumber: e.reservation?.number ?? null, vehicleType: e.vehicleType.name, pickupLocation: e.checkOutLocation.name, returnLocation: e.checkInLocation.name,
          status: e.status, openedBy: e.openedBy?.name ?? "", closedBy: e.closedBy?.name ?? "", closeDate: e.checkedInAt,
          invoiceTotal: round(e.invoices.reduce((a, i) => a + num(i.amount), 0)),
        };
      });
      const keys = ["days", "time", "discount", "mileage", "fuel", "upgrade", "oneWay", "damage", "trafficTickets", "adjust", "invoiceTotal", "total", "paid", "balance"] as const;
      const totals = Object.fromEntries(keys.map((k) => [k, round(rows.reduce((a, r) => a + (r[k] as number), 0))])) as Record<(typeof keys)[number], number>;
      return { rows, totals: { ...totals, other: [0, 1, 2, 3].map((i) => round(rows.reduce((a, r) => a + r.other[i]!, 0))) } };
    }),

  /**
   * Rental Invoices (ReportsRentalInvoice): long-term rental invoices — Date, Invoice #, Invoice Type, Customer, Vehicle,
   * License#, RA #, Location, Pickup Loc / Date, Return Loc, Drop Off Date, Total, Pay./Credit., Balance. Each rental's
   * payments are applied to its invoices oldest first.
   */
  rentalInvoices: staffProcedure
    .input(z.object({ locationId: optId, from: optDate, to: optDate, type: z.enum(["ALL", "INVOICE", "CREDIT"]).default("ALL"), balance: z.enum(["ALL", "ZERO", "OWING"]).default("ALL") }))
    .query(async ({ ctx, input }) => {
      const invs = await ctx.prisma.rentalInvoice.findMany({
        where: {
          rental: { deletedAt: null, ...(input.locationId ? { checkOutLocationId: input.locationId } : {}) },
          ...(range(input.from, input.to) ? { createdAt: range(input.from, input.to) } : {}),
          ...(input.type === "INVOICE" ? { isCredit: false } : input.type === "CREDIT" ? { isCredit: true } : {}),
        },
        orderBy: [{ rentalId: "asc" }, { createdAt: "asc" }],
        take: 5000,
        include: {
          rental: {
            select: {
              id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true } },
              vehicle: { select: { assignedId: true, licenseNumber: true, make: { select: { name: true } }, model: { select: { name: true } } } },
              checkOutLocation: { select: { name: true } }, checkInLocation: { select: { name: true } },
              payments: { select: { amount: true, transactionType: true } },
            },
          },
        },
      });
      const left = new Map<string, number>();
      const rows = invs
        .map((i) => {
          const r = i.rental;
          if (!left.has(r.id)) left.set(r.id, r.payments.reduce((a, p) => a + (p.transactionType === "PAYMENT" ? num(p.amount) : p.transactionType === "REFUND" ? -num(p.amount) : 0), 0));
          const total = num(i.amount);
          const paid = i.isCredit ? total : Math.min(Math.max(left.get(r.id)!, 0), total);
          if (!i.isCredit) left.set(r.id, left.get(r.id)! - paid);
          return {
            id: i.id, rentalId: r.id, date: i.createdAt, invoiceNumber: i.invoiceNumber, type: i.isCredit ? "Credit Memo" : "Invoice", customer: `${r.customer.firstName} ${r.customer.lastName}`,
            vehicle: `${r.vehicle.assignedId} ${r.vehicle.make.name} ${r.vehicle.model.name}`, license: r.vehicle.licenseNumber, raNumber: r.raNumber, location: r.checkOutLocation.name,
            pickupLocation: r.checkOutLocation.name, pickup: r.checkOutAt, returnLocation: r.checkInLocation.name, dropOff: r.checkedInAt ?? r.expectedReturnAt,
            total: round(total), paid: round(paid), balance: round(total - paid),
          };
        })
        .filter((r) => input.balance === "ALL" || (input.balance === "ZERO" ? r.balance === 0 : r.balance !== 0));
      const sum = (k: "total" | "paid" | "balance") => round(rows.reduce((a, r) => a + r[k], 0));
      return { rows, totals: { total: sum("total"), paid: sum("paid"), balance: sum("balance") } };
    }),

  /**
   * Rental / Reservation Event Tracking (ReportsAgreementsEventLog / ReportsReservationsEventLog): every change logged on a
   * rental or reservation (User, IP, Entered Date, RA # / Res #, FullName and what changed), by booking dates, name,
   * vehicle type, IP, keyword, user and location.
   */
  eventTracking: staffProcedure
    .input(
      z.object({
        kind: z.enum(["Rental", "Reservation"]),
        outFrom: optDate, outTo: optDate, inFrom: optDate, inTo: optDate, firstName: z.string().trim().optional(), lastName: z.string().trim().optional(),
        vehicleTypeId: optId, ip: z.string().trim().optional(), keyword: z.string().trim().optional(), userId: optId, locationId: optId,
      }),
    )
    .query(async ({ ctx, input }) => {
      const name = (f?: string, l?: string) => ({ ...(f ? { firstName: { contains: f, mode: "insensitive" as const } } : {}), ...(l ? { lastName: { contains: l, mode: "insensitive" as const } } : {}) });
      const bookings =
        input.kind === "Rental"
          ? (
              await ctx.prisma.rental.findMany({
                where: {
                  ...(range(input.outFrom, input.outTo) ? { checkOutAt: range(input.outFrom, input.outTo) } : {}),
                  ...(range(input.inFrom, input.inTo) ? { OR: [{ checkedInAt: range(input.inFrom, input.inTo) }, { checkedInAt: null, expectedReturnAt: range(input.inFrom, input.inTo) }] } : {}),
                  ...(input.firstName || input.lastName ? { customer: name(input.firstName, input.lastName) } : {}),
                  ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
                  ...(input.locationId ? { checkOutLocationId: input.locationId } : {}),
                },
                take: 5000,
                select: { id: true, raNumber: true, customer: { select: { firstName: true, lastName: true } } },
              })
            ).map((r) => ({ id: r.id, number: r.raNumber, fullName: `${r.customer.firstName} ${r.customer.lastName}` }))
          : (
              await ctx.prisma.reservation.findMany({
                where: {
                  ...(range(input.outFrom, input.outTo) ? { pickupAt: range(input.outFrom, input.outTo) } : {}),
                  ...(range(input.inFrom, input.inTo) ? { returnAt: range(input.inFrom, input.inTo) } : {}),
                  ...name(input.firstName, input.lastName),
                  ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
                  ...(input.locationId ? { pickupLocationId: input.locationId } : {}),
                },
                take: 5000,
                select: { id: true, number: true, firstName: true, lastName: true },
              })
            ).map((r) => ({ id: r.id, number: r.number, fullName: `${r.firstName} ${r.lastName}` }));
      const byId = new Map(bookings.map((b) => [b.id, b]));
      const logs = await ctx.prisma.auditLog.findMany({
        where: {
          entityType: input.kind,
          entityId: { in: [...byId.keys()] },
          ...(input.ip ? { ipAddress: { contains: input.ip } } : {}),
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.keyword ? { OR: [{ field: { contains: input.keyword, mode: "insensitive" } }, { oldValue: { contains: input.keyword, mode: "insensitive" } }, { newValue: { contains: input.keyword, mode: "insensitive" } }] } : {}),
        },
        orderBy: { at: "desc" },
        take: 5000,
        select: { id: true, entityId: true, field: true, oldValue: true, newValue: true, at: true, ipAddress: true, user: { select: { name: true } } },
      });
      return logs.map((l) => {
        const b = byId.get(l.entityId)!;
        return { id: l.id, bookingId: b.id, user: l.user?.name ?? "", ip: l.ipAddress ?? "", at: l.at, number: b.number, fullName: b.fullName, field: l.field, oldValue: l.oldValue ?? "", newValue: l.newValue ?? "" };
      });
    }),

  /** Revenue By Admin (ReportsCommissions): commissions entered, by the user who earned them — Full Name, Rental#, Commission Amount, Date Entered. */
  revenueByAdmin: staffProcedure
    .input(z.object({ from: optDate, to: optDate, locationOutId: optId, locationInId: optId }))
    .query(async ({ ctx, input }) => {
      const cs = await ctx.prisma.commission.findMany({
        where: {
          userId: { not: null },
          ...(range(input.from, input.to) ? { enteredAt: range(input.from, input.to) } : {}),
          rental: { deletedAt: null, ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}), ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}) },
        },
        orderBy: [{ user: { name: "asc" } }, { enteredAt: "asc" }],
        take: 5000,
        select: { id: true, amount: true, enteredAt: true, user: { select: { name: true } }, rental: { select: { id: true, raNumber: true } } },
      });
      const m = new Map<string, { name: string; rows: { id: string; rentalId: string; raNumber: number; amount: number; date: Date }[] }>();
      for (const c of cs) {
        const g = m.get(c.user!.name) ?? { name: c.user!.name, rows: [] };
        g.rows.push({ id: c.id, rentalId: c.rental.id, raNumber: c.rental.raNumber, amount: num(c.amount), date: c.enteredAt });
        m.set(c.user!.name, g);
      }
      const groups = [...m.values()].map((g) => ({ ...g, total: round(g.rows.reduce((a, r) => a + r.amount, 0)) }));
      return { groups, total: round(groups.reduce((a, g) => a + g.total, 0)) };
    }),

  /**
   * Revenue By Options (ReportsRevenueByOptions): for each insurance / tax / misc charge picked, the closed rentals that had
   * it — RA#, Pickup Date, First / Last Name, Vehicle Type, Assigned ID, Created By, Pickup / Return Location, No. Days,
   * Time, Mileage, Total, Option Amount — by rental close date, locations and customer.
   */
  revenueByOptions: staffProcedure
    .input(
      z.object({
        closeFrom: optDate, closeTo: optDate, locationIds: z.array(z.string()).default([]), locationOutId: optId, locationInId: optId, customer: z.string().trim().optional(),
        options: z.array(z.string()).default([]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const names = new Set(input.options);
      const rentals = await ctx.prisma.rental.findMany({
        where: {
          deletedAt: null,
          status: "CLOSED",
          ...(range(input.closeFrom, input.closeTo) ? { checkedInAt: range(input.closeFrom, input.closeTo) } : {}),
          ...(input.locationIds.length ? { checkOutLocationId: { in: input.locationIds } } : {}),
          ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
          ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
          ...(input.customer ? { customer: { OR: [{ firstName: { contains: input.customer, mode: "insensitive" } }, { lastName: { contains: input.customer, mode: "insensitive" } }] } } : {}),
          chargeLines: { some: { kind: { in: ["PROTECTION", "TAX", "MISC"] }, ...(names.size ? { name: { in: [...names] } } : {}) } },
        },
        orderBy: { raNumber: "asc" },
        take: 3000,
        select: {
          id: true, raNumber: true, checkOutAt: true, customer: { select: { firstName: true, lastName: true } }, vehicleType: { select: { name: true } }, vehicle: { select: { assignedId: true } },
          openedBy: { select: { name: true } }, checkOutLocation: { select: { name: true } }, checkInLocation: { select: { name: true } }, chargeLines: { select: { kind: true, name: true, units: true, total: true } },
        },
      });
      const GROUP: Record<string, string> = { PROTECTION: "Insurances", TAX: "Taxes", MISC: "MiscCharges" };
      const groups = new Map<string, Map<string, { rows: Record<string, unknown>[]; total: number }>>();
      for (const r of rentals) {
        const by = (...k: string[]) => round(r.chargeLines.filter((l) => k.includes(l.kind)).reduce((a, l) => a + num(l.total), 0));
        const base = {
          id: r.id, raNumber: r.raNumber, pickup: r.checkOutAt, firstName: r.customer.firstName, lastName: r.customer.lastName, vehicleType: r.vehicleType.name, assignedId: r.vehicle.assignedId,
          createdBy: r.openedBy?.name ?? "", pickupLocation: r.checkOutLocation.name, returnLocation: r.checkInLocation.name, days: rentalDays(r.chargeLines), time: by("TIME"), mileage: by("MILEAGE"),
          total: round(r.chargeLines.reduce((a, l) => a + num(l.total), 0)),
        };
        for (const l of r.chargeLines.filter((x) => GROUP[x.kind] && (!names.size || names.has(x.name)))) {
          const g = groups.get(GROUP[l.kind]!) ?? new Map();
          const o = g.get(l.name) ?? { rows: [], total: 0 };
          o.rows.push({ ...base, amount: round(num(l.total)) });
          o.total = round(o.total + num(l.total));
          g.set(l.name, o);
          groups.set(GROUP[l.kind]!, g);
        }
      }
      return ["Insurances", "Taxes", "MiscCharges"].filter((k) => groups.has(k)).map((k) => ({
        group: k,
        options: [...groups.get(k)!.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, o]) => ({ name, total: o.total, rows: o.rows as (typeof o.rows)[number][] })),
      }));
    }),

  /** Option names (insurances / taxes / misc charges) used on rentals, for the Revenue By Options picker. */
  optionNames: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.chargeLine.groupBy({ by: ["kind", "name"], where: { rentalId: { not: null }, kind: { in: ["PROTECTION", "TAX", "MISC"] } }, orderBy: { name: "asc" } });
    return rows.map((r) => ({ kind: r.kind, name: r.name }));
  }),

  /** Non-Revenue (ReportsNonRevenueMove): rentals marked Non-Revenue — Rental#, Full Name, Vehicle ID, Model, Pickup / Return Date. */
  nonRevenue: staffProcedure
    .input(
      z.object({
        outFrom: optDate, outTo: optDate, inFrom: optDate, inTo: optDate, makeId: optId, locationOutId: optId, locationInId: optId, vehicleTypeId: optId,
        status: z.enum(["", "OPEN", "CLOSED"]).default(""),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.prisma.rental
        .findMany({
          where: {
            deletedAt: null,
            isNonRevenue: true,
            ...(input.status ? { status: input.status } : {}),
            ...(range(input.outFrom, input.outTo) ? { checkOutAt: range(input.outFrom, input.outTo) } : {}),
            ...(range(input.inFrom, input.inTo) ? { OR: [{ checkedInAt: range(input.inFrom, input.inTo) }, { checkedInAt: null, expectedReturnAt: range(input.inFrom, input.inTo) }] } : {}),
            ...(input.makeId ? { vehicle: { makeId: input.makeId } } : {}),
            ...(input.vehicleTypeId ? { vehicleTypeId: input.vehicleTypeId } : {}),
            ...(input.locationOutId ? { checkOutLocationId: input.locationOutId } : {}),
            ...(input.locationInId ? { checkInLocationId: input.locationInId } : {}),
          },
          orderBy: { raNumber: "asc" },
          take: 3000,
          select: { id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { id: true, assignedId: true, make: { select: { name: true } }, model: { select: { name: true } } } } },
        })
        .then((rs) => rs.map((r) => ({ id: r.id, raNumber: r.raNumber, fullName: `${r.customer.firstName} ${r.customer.lastName}`, vehicleId: r.vehicle.id, assignedId: r.vehicle.assignedId, model: `${r.vehicle.make.name} ${r.vehicle.model.name}`, pickup: r.checkOutAt, return: r.checkedInAt ?? r.expectedReturnAt }))),
    ),

  /**
   * Vehicle Insurance (ReportsLocationInsurance): per vehicle its insurance records in the period — Insurance Expiry, how many
   * No Insurance / Full Coverage / Liability Only / Comprehensive Only records and their amounts, and the latest Action Type.
   */
  vehicleInsurance: staffProcedure
    .input(z.object({ makeId: optId, from: optDate, to: optDate, locationId: optId, currentLocationId: optId, vehicleTypeId: optId, actionType: z.enum(["", "NO_INSURANCE", "FULL_COVERAGE", "LIABILITY_ONLY", "COMPREHENSIVE_ONLY"]).default("") }))
    .query(async ({ ctx, input }) => {
      const recs = await ctx.prisma.vehicleInsuranceRecord.findMany({
        where: {
          ...(range(input.from, input.to) ? { date: range(input.from, input.to) } : {}),
          ...(input.actionType ? { actionType: input.actionType } : {}),
          vehicle: { ...vehicleFilter(input), ...(input.currentLocationId ? { currentLocationId: input.currentLocationId } : {}) },
        },
        orderBy: [{ vehicle: { assignedId: "asc" } }, { date: "asc" }],
        take: 5000,
        select: { date: true, expiryDate: true, actionType: true, insuranceAmount: true, vehicle: { select: { id: true, assignedId: true } } },
      });
      const m = new Map<string, { vehicleId: string; assignedId: string; expiry: Date | null; count: Record<string, number>; amount: Record<string, number>; action: string }>();
      for (const r of recs) {
        const g = m.get(r.vehicle.id) ?? { vehicleId: r.vehicle.id, assignedId: r.vehicle.assignedId, expiry: null, count: {}, amount: {}, action: "" };
        g.count[r.actionType] = (g.count[r.actionType] ?? 0) + 1;
        g.amount[r.actionType] = round((g.amount[r.actionType] ?? 0) + num(r.insuranceAmount));
        g.expiry = r.expiryDate ?? g.expiry;
        g.action = r.actionType;
        m.set(r.vehicle.id, g);
      }
      return [...m.values()];
    }),

  /** Vehicle Lease/Loan (ReportsVehicleLeaseLoan): vehicles with Ownership Information — selling company, bank, loan and payments. */
  vehicleLeaseLoan: staffProcedure
    .input(z.object({ companyId: optId, makeId: optId, year: z.coerce.number().int().optional(), locationId: optId, currentLocationId: optId, vehicleTypeId: optId }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.vehicleOwnership.findMany({
        where: {
          ...(input.companyId ? { sellingCompanyId: input.companyId } : {}),
          vehicle: { isActive: true, ...vehicleFilter(input), ...(input.currentLocationId ? { currentLocationId: input.currentLocationId } : {}) },
        },
        orderBy: { vehicle: { assignedId: "asc" } },
        take: 3000,
        include: { sellingCompany: { select: { name: true } }, vehicle: { select: { id: true, assignedId: true, year: true, make: { select: { name: true } }, model: { select: { name: true } } } } },
      });
      return rows.map((o) => ({
        vehicleId: o.vehicle.id, assignedId: o.vehicle.assignedId, vehicle: `${o.vehicle.year ?? ""} ${o.vehicle.make.name} ${o.vehicle.model.name}`.trim(), company: o.sellingCompany?.name ?? "",
        bank: o.bank ?? "", loanNumber: o.loanNumber ?? "", acquisitionDate: o.acquisitionDate, financeAmount: num(o.financeAmount), monthlyPayment: num(o.monthlyPayment),
        interestRate: num(o.interestRate), leaseTerm: o.leaseTerm ?? "", remainingPayments: o.remainingPayments, payoffAmount: num(o.payoffAmount), balanceOwed: num(o.balanceOwed),
      }));
    }),

  /**
   * KM Difference/Missing (ReportVehicleMilesDiff): each vehicle's rentals in order — Rental #, Pickup / Return Date, Days,
   * Days Diff (idle days since the previous rental), Odometer Out / In, Kilometers Diff (km driven between rentals, i.e.
   * missing from any rental), Exchanged.
   */
  kmDifference: staffProcedure
    .input(z.object({ makeId: optId, from: optDate, to: optDate, assignedId: z.string().trim().optional(), locationId: optId, vehicleTypeId: optId }))
    .query(async ({ ctx, input }) => {
      const rs = await ctx.prisma.rental.findMany({
        where: { deletedAt: null, status: { in: ["OPEN", "CLOSED"] }, ...(range(input.from, input.to) ? { checkOutAt: range(input.from, input.to) } : {}), vehicle: vehicleFilter(input) },
        orderBy: [{ vehicleId: "asc" }, { checkOutAt: "asc" }],
        take: 5000,
        select: {
          id: true, raNumber: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, odometerOut: true, odometerIn: true,
          vehicle: { select: { id: true, assignedId: true } }, _count: { select: { vehicleSegments: true } },
        },
      });
      const groups = new Map<string, { vehicleId: string; assignedId: string; rows: Record<string, unknown>[] }>();
      let prev: (typeof rs)[number] | null = null;
      for (const r of rs) {
        const g = groups.get(r.vehicle.id) ?? { vehicleId: r.vehicle.id, assignedId: r.vehicle.assignedId, rows: [] };
        const back = r.checkedInAt ?? r.expectedReturnAt;
        const same = prev && prev.vehicle.id === r.vehicle.id ? prev : null;
        g.rows.push({
          id: r.id, raNumber: r.raNumber, pickup: r.checkOutAt, return: back, days: Math.max(1, Math.ceil((+back - +r.checkOutAt) / DAY)),
          daysDiff: same ? Math.round((+r.checkOutAt - +(same.checkedInAt ?? same.expectedReturnAt)) / DAY) : null,
          odometerOut: r.odometerOut, odometerIn: r.odometerIn, kmDiff: same && same.odometerIn != null ? r.odometerOut - same.odometerIn : null, exchanged: r._count.vehicleSegments > 1,
        });
        groups.set(r.vehicle.id, g);
        prev = r;
      }
      return [...groups.values()];
    }),

  /** Vehicle Utilization (Today) (ReportsVehicleStatus): every active vehicle's status now and its open rental. */
  vehicleUtilization: staffProcedure
    .input(z.object({ makeId: optId, year: z.coerce.number().int().optional(), locationId: optId, currentLocationId: optId, vehicleTypeId: optId }))
    .query(async ({ ctx, input }) => {
      const vs = await ctx.prisma.vehicle.findMany({
        where: { isActive: true, ...vehicleFilter(input), ...(input.currentLocationId ? { currentLocationId: input.currentLocationId } : {}) },
        orderBy: { assignedId: "asc" },
        select: {
          id: true, assignedId: true, licenseNumber: true, status: true, year: true, currentOdometer: true, vin: true, make: { select: { name: true } }, model: { select: { name: true } },
          vehicleType: { select: { name: true } }, owningLocation: { select: { name: true } }, currentLocation: { select: { name: true } }, rentalLocation: { select: { name: true } },
          rentals: { where: { status: "OPEN", deletedAt: null }, take: 1, select: { id: true, raNumber: true } },
        },
      });
      const rows = vs.map((v) => ({
        id: v.id, assignedId: v.assignedId, plate: v.licenseNumber, owning: v.owningLocation.name, current: (v.currentLocation ?? v.rentalLocation).name, status: v.status,
        rentalId: v.rentals[0]?.id ?? null, raNumber: v.rentals[0]?.raNumber ?? null, type: v.vehicleType.name, year: v.year, odometer: v.currentOdometer, make: v.make.name, model: v.model.name, vin: v.vin ?? "",
      }));
      const byStatus = new Map<string, number>();
      for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      return { rows, summary: [...byStatus.entries()].map(([status, count]) => ({ status, count })), onRentPercent: rows.length ? round((rows.filter((r) => r.status === "ON_RENT").length / rows.length) * 100) : 0 };
    }),

  /**
   * Vehicle Profit/Loss (ReportVehicleProfit): per vehicle in the period — Rent Length (days rented), Driven Miles, Income
   * (rental charges before tax), Depreciation (Ownership "Mo. Dep. Amt." × months in the period), Expenses (maintenance
   * payments + repair parts and labour + damage totals), Price (Ownership price), Profit = Income − Depreciation − Expenses.
   */
  vehicleProfit: staffProcedure
    .input(z.object({ makeId: optId, from: optDate, to: optDate, assignedId: z.string().trim().optional(), locationId: optId, owningLocationId: optId, currentLocationId: optId, vehicleTypeId: optId }))
    .query(async ({ ctx, input }) => {
      const when = range(input.from, input.to);
      const vs = await ctx.prisma.vehicle.findMany({
        where: {
          isActive: true, ...vehicleFilter(input),
          ...(input.owningLocationId ? { owningLocationId: input.owningLocationId } : {}), ...(input.currentLocationId ? { currentLocationId: input.currentLocationId } : {}),
        },
        orderBy: { assignedId: "asc" },
        take: 2000,
        select: {
          id: true, assignedId: true, year: true, vin: true, ownership: { select: { price: true, acquisitionPrice: true, moDepAmt: true } },
          rentals: { where: { deletedAt: null, status: { in: ["OPEN", "CLOSED"] }, ...(when ? { checkOutAt: when } : {}) }, select: { checkOutAt: true, checkedInAt: true, expectedReturnAt: true, odometerOut: true, odometerIn: true, chargeLines: { select: { kind: true, total: true } } } },
          maintenances: { where: when ? { date: when } : {}, select: { paymentAmount: true, labourCost: true, partsCost: true } },
          repairs: { where: when ? { date: when } : {}, select: { totalParts: true, totalLabour: true } },
          damages: { where: when ? { date: when } : {}, select: { total: true } },
        },
      });
      const months = input.from && input.to ? Math.max(1, Math.round((+input.to - +input.from) / (30 * DAY))) : 0;
      return vs.map((v) => {
        const days = v.rentals.reduce((a, r) => a + Math.max(1, Math.ceil((+(r.checkedInAt ?? r.expectedReturnAt) - +r.checkOutAt) / DAY)), 0);
        const km = v.rentals.reduce((a, r) => a + (r.odometerIn != null ? Math.max(0, r.odometerIn - r.odometerOut) : 0), 0);
        const income = round(v.rentals.reduce((a, r) => a + r.chargeLines.filter((l) => l.kind !== "TAX").reduce((b, l) => b + num(l.total), 0), 0));
        const depreciation = round(num(v.ownership?.moDepAmt) * months);
        const expenses = round(
          v.maintenances.reduce((a, m) => a + (m.paymentAmount != null ? num(m.paymentAmount) : num(m.labourCost) + num(m.partsCost)), 0) +
            v.repairs.reduce((a, r) => a + num(r.totalParts) + num(r.totalLabour), 0) +
            v.damages.reduce((a, d) => a + num(d.total), 0),
        );
        return { id: v.id, assignedId: v.assignedId, year: v.year, vin: v.vin ?? "", days, km, income, depreciation, expenses, price: num(v.ownership?.price ?? v.ownership?.acquisitionPrice), profit: round(income - depreciation - expenses) };
      });
    }),

  /** Pick-lists for the report filters. */
  filters: staffProcedure.query(async ({ ctx }) => {
    const [locations, makes, types] = await Promise.all([
      ctx.prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.vehicleMake.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    const [companies, referrals, regions] = await Promise.all([
      ctx.prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
      ctx.prisma.referral.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ctx.prisma.lookup.findMany({ where: { kind: "CUSTOMER_REGION" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    const agents = await ctx.prisma.user.findMany({ where: { OR: [{ banned: null }, { banned: false }] }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    return { locations, makes, types, referrals, regions, agents, companies: companies.map((c) => ({ id: c.id, name: c.code ? `${c.name} (${c.code})` : c.name })) };
  }),
});
