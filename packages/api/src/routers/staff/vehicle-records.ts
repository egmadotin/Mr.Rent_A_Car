import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, permitted, requirePermission } from "../../trpc";
import { audit } from "../../lib/audit";
import { deleteFile, isStorageKey } from "../../lib/storage";

/**
 * The vehicle page's records (RentCentric VehicleMain.aspx actions): Maintenance, Repairs, Problems, Carwash, Damage,
 * Accidents, Vehicle Services, Insurances, Status Change, Deactivate and Vehicle History. Fields as on each
 * *Modify.aspx form; permissions as the RentCentric group ticks (Maintenance / Repairs / Vehicle Problems / Carwash /
 * Damages / Accidents; the rest under Vehicles › Edit).
 */

const D = (v: number | null | undefined) => (v == null ? null : new Prisma.Decimal(v));
const optStr = z.string().trim().max(4000).optional().nullable().transform((v) => v || null);
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0, "Can't be negative").nullable());
const optMoney = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0, "Can't be negative").finite().nullable());
const reqDate = (label: string) => z.preprocess((v) => (v === "" || v == null ? undefined : new Date(v as string)), z.date({ required_error: `${label} is required`, invalid_type_error: `${label} is required` }).refine((d) => !Number.isNaN(+d), `${label} is required`));
const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable());
const STATUSES = ["ACCIDENT_REPLACEMENT", "AUCTION", "AVAILABLE", "COMPREHENSIVE", "FOR_SALE", "GROUNDED", "HAS_PROBLEM", "HOLD_FOR_SALE", "IN_CHECKOUT_PROCESS", "IN_REPAIR", "IN_SERVICE", "LEASED_REPLACEMENT", "ON_RENT", "OUT_OF_SERVICE", "SOLD", "STAFF", "STOLEN"] as const;
const PAYMENT = ["AMEX", "CASH", "DEBIT", "EMT", "INTERNAL", "MASTERCARD", "VISA"] as const;

const inputs = {
  maintenance: z.object({
    date: reqDate("Current Maintenance Date"),
    type: optStr,
    odometer: optInt,
    nextDateRequired: z.boolean().default(false),
    nextDate: optDate,
    nextType: optStr,
    nextOdometer: optInt,
    shop: optStr,
    shopContactName: optStr,
    shopPhone: optStr,
    labourCost: optMoney,
    partsCost: optMoney,
    paymentMethod: z.preprocess((v) => (v === "" ? null : v), z.enum(PAYMENT).nullable().optional()),
    paymentAmount: optMoney,
    poNumber: optStr,
    memo: optStr,
  }),
  repair: z.object({
    date: reqDate("Repair Date"),
    dateDue: optDate,
    pickupDate: optDate,
    returnDate: optDate,
    pickupLocationId: optStr,
    returnLocationId: optStr,
    odometerOut: optInt,
    odometerIn: optInt,
    shopName: optStr,
    totalParts: optMoney,
    totalLabour: optMoney,
    repairOrderNumber: optStr,
    purchaseOrderNumber: optStr,
    description: optStr,
  }),
  problem: z.object({ date: reqDate("Problem Date"), odometer: optInt, status: z.preprocess((v) => (v === "" ? null : v), z.enum(STATUSES).nullable().optional()), description: optStr }),
  carwash: z.object({ date: reqDate("Carwash Date"), odometer: optInt, updateOdometer: z.boolean().default(false), washedBy: optStr, spotNumber: optStr, memo: optStr }),
  damage: z.object({
    date: reqDate("Date"),
    rentalId: optStr,
    locationId: optStr,
    conditionId: optStr,
    total: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ required_error: "Total is required" }).min(0, "Can't be negative")),
    memo: optStr,
    /** the damage photo (uploaded to /api/files); left out = unchanged */
    imageKey: z.string().refine(isStorageKey, "Bad file key").optional(),
  }),
  accident: z.object({ date: reqDate("Accident Date"), rentalId: optStr, fullName: optStr, location: optStr, description: optStr, memo: optStr }),
  service: z.object({ companyName: z.string().trim().min(1, "Company Name is required"), voucherNumber: optStr, expirationDate: optDate, memo: optStr }),
  insurance: z.object({
    date: reqDate("Date"),
    expiryDate: optDate,
    actionType: z.enum(["NO_INSURANCE", "FULL_COVERAGE", "LIABILITY_ONLY", "COMPREHENSIVE_ONLY"], { required_error: "Action Type is required" }),
    insuranceAmount: optMoney,
    deductibleAmount: optMoney,
    policyNumber: optStr,
    reason: optStr,
  }),
};
type Kind = keyof typeof inputs;
const KINDS = Object.keys(inputs) as [Kind, ...Kind[]];

/** RentCentric permission ids per record kind: [add, edit, delete]. */
const PERMS: Record<Kind, [string, string, string]> = {
  maintenance: ["MaintenanceAdd", "MaintenanceEdit", "MaintenanceDelete"],
  repair: ["RepairsAdd", "RepairsEdit", "RepairsDelete"],
  problem: ["VehicleProblemsAdd", "VehicleProblemsEdit", "VehicleProblemsDelete"],
  carwash: ["CarwashAdd", "CarwashEdit", "CarwashDelete"],
  damage: ["DamagesAdd", "DamagesEdit", "DamagesEdit"], // RentCentric has no separate "delete damage" tick
  accident: ["AccidentsAdd", "AccidentsEdit", "AccidentsDelete"],
  service: ["VehiclesEdit", "VehiclesEdit", "VehiclesEdit"],
  insurance: ["VehiclesEdit", "VehiclesEdit", "VehiclesEdit"],
};
const LABEL: Record<Kind, string> = { maintenance: "Maintenance", repair: "Repair", problem: "Problem", carwash: "Carwash", damage: "Damage", accident: "Accident", service: "Vehicle service", insurance: "Insurance" };

/** Converts money fields to Decimal for Prisma. */
function toData(kind: Kind, d: Record<string, unknown>) {
  const money: Record<Kind, string[]> = {
    maintenance: ["labourCost", "partsCost", "paymentAmount"],
    repair: ["totalParts", "totalLabour"],
    problem: [],
    carwash: [],
    damage: ["total"],
    accident: [],
    service: [],
    insurance: ["insuranceAmount", "deductibleAmount"],
  };
  const out = { ...d };
  for (const k of money[kind]) out[k] = D(d[k] as number | null);
  return out;
}

type Tx = Prisma.TransactionClient;
/** One switch instead of a dynamic model lookup, so every call stays typed by Prisma. */
async function write(tx: Tx, kind: Kind, op: "create" | "update" | "delete", id: string | undefined, data: Record<string, unknown>) {
  const where = { id: id! };
  switch (kind) {
    case "maintenance":
      return op === "create" ? tx.vehicleMaintenance.create({ data: data as Prisma.VehicleMaintenanceUncheckedCreateInput }) : op === "update" ? tx.vehicleMaintenance.update({ where, data }) : tx.vehicleMaintenance.delete({ where });
    case "repair":
      return op === "create" ? tx.vehicleRepair.create({ data: data as Prisma.VehicleRepairUncheckedCreateInput }) : op === "update" ? tx.vehicleRepair.update({ where, data }) : tx.vehicleRepair.delete({ where });
    case "problem":
      return op === "create" ? tx.vehicleProblem.create({ data: data as Prisma.VehicleProblemUncheckedCreateInput }) : op === "update" ? tx.vehicleProblem.update({ where, data }) : tx.vehicleProblem.delete({ where });
    case "carwash":
      return op === "create" ? tx.vehicleCarwash.create({ data: data as Prisma.VehicleCarwashUncheckedCreateInput }) : op === "update" ? tx.vehicleCarwash.update({ where, data }) : tx.vehicleCarwash.delete({ where });
    case "damage":
      return op === "create" ? tx.vehicleDamage.create({ data: data as Prisma.VehicleDamageUncheckedCreateInput }) : op === "update" ? tx.vehicleDamage.update({ where, data }) : tx.vehicleDamage.delete({ where });
    case "accident":
      return op === "create" ? tx.vehicleAccident.create({ data: data as Prisma.VehicleAccidentUncheckedCreateInput }) : op === "update" ? tx.vehicleAccident.update({ where, data }) : tx.vehicleAccident.delete({ where });
    case "service":
      return op === "create" ? tx.vehicleServiceVoucher.create({ data: data as Prisma.VehicleServiceVoucherUncheckedCreateInput }) : op === "update" ? tx.vehicleServiceVoucher.update({ where, data }) : tx.vehicleServiceVoucher.delete({ where });
    case "insurance":
      return op === "create" ? tx.vehicleInsuranceRecord.create({ data: data as Prisma.VehicleInsuranceRecordUncheckedCreateInput }) : op === "update" ? tx.vehicleInsuranceRecord.update({ where, data }) : tx.vehicleInsuranceRecord.delete({ where });
  }
}

/** Sets the vehicle's status and keeps a Status Change line for its history. */
async function setStatus(tx: Tx, vehicleId: string, status: (typeof STATUSES)[number], userId: string, at = new Date(), dueBackAt: Date | null = null) {
  const v = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { status: true } });
  await tx.vehicle.update({ where: { id: vehicleId }, data: { status } });
  await tx.vehicleStatusChange.create({ data: { vehicleId, status, fromStatus: v.status, changedAt: at, dueBackAt, enteredById: userId } });
  await audit(tx, "Vehicle", vehicleId, userId, { Status: [v.status, status] });
}

const saveInput = z.discriminatedUnion("kind", KINDS.map((k) => z.object({ kind: z.literal(k), id: z.string().optional(), vehicleId: z.string(), data: inputs[k] })) as unknown as [z.ZodObject<{ kind: z.ZodLiteral<Kind>; id: z.ZodOptional<z.ZodString>; vehicleId: z.ZodString; data: z.ZodTypeAny }>]);

export const vehicleRecordsRouter = router({
  /** Everything on the vehicle page's panels. */
  list: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const where = { vehicleId: input.vehicleId };
    const desc = { createdAt: "desc" } as const;
    const [maintenances, repairs, problems, carwashes, damages, accidents, services, insurances, statusChanges, users, locations] = await Promise.all([
      ctx.prisma.vehicleMaintenance.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleRepair.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleProblem.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleCarwash.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleDamage.findMany({ where, orderBy: [{ date: "desc" }, desc], include: { location: { select: { name: true } }, condition: { select: { name: true } } } }),
      ctx.prisma.vehicleAccident.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleServiceVoucher.findMany({ where, orderBy: desc }),
      ctx.prisma.vehicleInsuranceRecord.findMany({ where, orderBy: [{ date: "desc" }, desc] }),
      ctx.prisma.vehicleStatusChange.findMany({ where, orderBy: [{ changedAt: "desc" }, desc] }),
      ctx.prisma.user.findMany({ where: { kind: "STAFF" }, select: { id: true, name: true } }),
      ctx.prisma.location.findMany({ select: { id: true, name: true } }),
    ]);
    return {
      maintenances, repairs, problems, carwashes, damages, accidents, services, insurances, statusChanges,
      userNames: Object.fromEntries(users.map((u) => [u.id, u.name])),
      locationNames: Object.fromEntries(locations.map((l) => [l.id, l.name])),
    };
  }),

  /** Add / edit one record (Maintenance, Repair, Problem, Carwash, Damage, Accident, Service, Insurance). */
  save: permitted("Vehicles")
    .input(saveInput)
    .mutation(async ({ ctx, input }) => {
      const afterCommit: string[] = [];
      const res = await ctx.prisma.$transaction(async (tx) => {
        const { kind, id, vehicleId } = input as { kind: Kind; id?: string; vehicleId: string; data: Record<string, unknown> };
        const data = (input as { data: Record<string, unknown> }).data;
        await requirePermission(ctx, PERMS[kind][id ? 1 : 0]);
        const v = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentOdometer: true } });
        if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
        const row = toData(kind, data);
        // a replaced damage photo is removed from storage once the save commits
        const oldImage = kind === "damage" && id && data.imageKey ? (await tx.vehicleDamage.findUnique({ where: { id }, select: { imageKey: true } }))?.imageKey : null;
        if (oldImage && oldImage !== data.imageKey) afterCommit.push(oldImage);
        const saved = (await write(tx, kind, id ? "update" : "create", id, id ? row : { ...row, vehicleId, enteredById: ctx.user.id })) as { id: string };
        // RentCentric side effects: a Problem's Status sets the vehicle's status; "Update Odometer" on Carwash sets it
        if (kind === "problem" && data.status) await setStatus(tx, vehicleId, data.status as (typeof STATUSES)[number], ctx.user.id);
        if (kind === "carwash" && data.updateOdometer && data.odometer != null) await tx.vehicle.update({ where: { id: vehicleId }, data: { currentOdometer: data.odometer as number } });
        await audit(tx, "Vehicle", vehicleId, ctx.user.id, { [LABEL[kind]]: [id ? "edited" : null, id ? "saved" : "added"] });
        return { id: saved.id };
      });
      await Promise.all(afterCommit.map(deleteFile));
      return res;
    }),

  delete: permitted("Vehicles")
    .input(z.object({ kind: z.enum(KINDS), id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        await requirePermission(ctx, PERMS[input.kind][2]);
        const row = (await write(tx, input.kind, "delete", input.id, {})) as { vehicleId: string; imageKey?: string | null };
        await audit(tx, "Vehicle", row.vehicleId, ctx.user.id, { [LABEL[input.kind]]: ["deleted", null] });
        return row.imageKey;
      }).then((imageKey) => (imageKey ? deleteFile(imageKey) : undefined)),
    ),

  /** Status Change (VehicleStatusChangeModify.aspx: Status, Change Date/Time, Due Back Date/Time). */
  changeStatus: permitted("VehiclesEdit")
    .input(z.object({ vehicleId: z.string(), status: z.enum(STATUSES), changedAt: z.coerce.date(), dueBackAt: optDate }))
    .mutation(({ ctx, input }) => ctx.prisma.$transaction((tx) => setStatus(tx, input.vehicleId, input.status, ctx.user.id, input.changedAt, input.dueBackAt))),
  deleteStatusChange: permitted("VehiclesEdit").input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.vehicleStatusChange.delete({ where: { id: input.id } });
  }),

  /** Deactivate / reactivate (RentCentric "Deactivate"; the "Disable" tick). An on-rent vehicle can't be deactivated. */
  setActive: permitted("VehiclesDelete")
    .input(z.object({ vehicleId: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId }, select: { isActive: true, status: true } });
        if (!input.active && v.status === "ON_RENT") throw new TRPCError({ code: "BAD_REQUEST", message: "This vehicle is on rent. End the rental before deactivating it." });
        await tx.vehicle.update({ where: { id: input.vehicleId }, data: { isActive: input.active } });
        await audit(tx, "Vehicle", input.vehicleId, ctx.user.id, { Active: [v.isActive ? "yes" : "no", input.active ? "yes" : "no"] });
      }),
    ),

  /** The vehicle page's Rentals and Reservations links (VehicleAgreementsMain / VehicleReservationsMain). */
  bookings: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const [rentals, reservations] = await Promise.all([
      ctx.prisma.rental.findMany({
        where: { deletedAt: null, OR: [{ vehicleId: input.vehicleId }, { vehicleSegments: { some: { vehicleId: input.vehicleId } } }] },
        orderBy: { checkOutAt: "desc" },
        take: 200,
        select: { id: true, raNumber: true, status: true, checkOutAt: true, checkedInAt: true, expectedReturnAt: true, customer: { select: { firstName: true, lastName: true } } },
      }),
      ctx.prisma.reservation.findMany({
        where: { deletedAt: null, vehicleId: input.vehicleId },
        orderBy: { pickupAt: "desc" },
        take: 200,
        select: { id: true, number: true, status: true, pickupAt: true, returnAt: true, firstName: true, lastName: true, customer: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    return { rentals, reservations };
  }),

  /**
   * Vehicle History (VehicleHistoryList.aspx: Action, Date, Prev./Cur. Location, Prev./Cur. Status, Rental #,
   * Reservation #, Odometer, Fuel, User, Memo) — built from the rentals and the vehicle's own records.
   */
  history: permitted("Vehicles").input(z.object({ vehicleId: z.string() })).query(async ({ ctx, input }) => {
    const id = input.vehicleId;
    const [segments, records, users, locations] = await Promise.all([
      ctx.prisma.rentalVehicleSegment.findMany({
        where: { vehicleId: id },
        include: { rental: { select: { id: true, raNumber: true, reservation: { select: { number: true } }, checkOutLocationId: true, checkInLocationId: true, openedById: true, closedById: true } } },
      }),
      ctx.prisma.vehicle.findUniqueOrThrow({
        where: { id },
        select: { statusChanges: true, maintenances: true, repairs: true, problems: true, carwashes: true, damages: true, accidents: true },
      }),
      ctx.prisma.user.findMany({ where: { kind: "STAFF" }, select: { id: true, name: true } }),
      ctx.prisma.location.findMany({ select: { id: true, name: true } }),
    ]);
    const user = new Map(users.map((u) => [u.id, u.name]));
    const loc = new Map(locations.map((l) => [l.id, l.name]));
    type Row = { action: string; date: Date; prevLocation?: string | null; curLocation?: string | null; prevStatus?: string | null; curStatus?: string | null; rentalId?: string; raNumber?: number; reservationNumber?: number | null; odometer?: number | null; fuel?: number | null; user?: string | null; memo?: string | null };
    const rows: Row[] = [];
    for (const s of segments) {
      const r = s.rental;
      rows.push({ action: "Rental out", date: s.startsAt, curLocation: loc.get(r.checkOutLocationId), curStatus: "ON_RENT", rentalId: r.id, raNumber: r.raNumber, reservationNumber: r.reservation?.number, odometer: s.odometerOut, fuel: s.fuelOut, user: user.get(r.openedById ?? "") });
      if (s.endsAt) rows.push({ action: "Rental in", date: s.endsAt, prevLocation: loc.get(r.checkOutLocationId), curLocation: loc.get(r.checkInLocationId), prevStatus: "ON_RENT", curStatus: "AVAILABLE", rentalId: r.id, raNumber: r.raNumber, reservationNumber: r.reservation?.number, odometer: s.odometerIn, fuel: s.fuelIn, user: user.get(r.closedById ?? "") });
    }
    for (const c of records.statusChanges) rows.push({ action: "Status change", date: c.changedAt, prevStatus: c.fromStatus, curStatus: c.status, user: user.get(c.enteredById ?? ""), memo: c.dueBackAt ? `Due back ${c.dueBackAt.toISOString()}` : null });
    for (const m of records.maintenances) rows.push({ action: "Maintenance", date: m.date, odometer: m.odometer, user: user.get(m.enteredById ?? ""), memo: [m.type, m.memo].filter(Boolean).join(" — ") || null });
    for (const m of records.repairs) rows.push({ action: "Repair", date: m.date, odometer: m.odometerOut, user: user.get(m.enteredById ?? ""), memo: m.description });
    for (const m of records.problems) rows.push({ action: "Problem", date: m.date, odometer: m.odometer, curStatus: m.status, user: user.get(m.enteredById ?? ""), memo: m.description });
    for (const m of records.carwashes) rows.push({ action: "Carwash", date: m.date, odometer: m.odometer, user: user.get(m.enteredById ?? ""), memo: m.memo });
    for (const m of records.damages) rows.push({ action: "Damage", date: m.date, user: user.get(m.enteredById ?? ""), memo: m.memo });
    for (const m of records.accidents) rows.push({ action: "Accident", date: m.date, user: user.get(m.enteredById ?? ""), memo: m.description });
    return rows.sort((a, b) => +b.date - +a.date);
  }),
});
