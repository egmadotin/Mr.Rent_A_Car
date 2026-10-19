import { z } from "zod";
import { router, staffProcedure } from "../../trpc";
import { locationTz, priceBooking, seasonsAt } from "../../lib/pricing";
import { localDateAsUtc } from "../../lib/tz";
import { bookingOptionsInput, staffPricingOptions } from "../../lib/booking-options";

/**
 * What the legacy Quote / Reserve / Start Rental screens show once location, dates and vehicle type
 * are chosen: the Rate dropdown ("CODE ($daily)") and the options grid (insurances, misc charges and
 * taxes, with defaults pre-ticked and grouped charges as pick-one).
 */
export const bookingRouter = router({
  options: staffProcedure
    .input(z.object({ locationId: z.string().min(1), vehicleTypeId: z.string().min(1), at: z.coerce.date(), returnAt: z.coerce.date().optional() }))
    .query(async ({ ctx, input }) => {
      const tz = await locationTz(ctx.prisma, input.locationId);
      const seasonIds = await seasonsAt(ctx.prisma, input.at, tz);
      const day = localDateAsUtc(input.at, tz);
      const applicable = {
        isActive: true,
        OR: [{ locationId: input.locationId }, { locationId: null }],
        AND: [
          { OR: [{ allVehicleTypes: true }, { vehicleTypes: { some: { vehicleTypeId: input.vehicleTypeId } } }] },
          { OR: [{ effectiveDate: null }, { effectiveDate: { lte: day } }] },
          { OR: [{ endDate: null }, { endDate: { gte: day } }] },
        ],
      };

      const [rates, insurances, misc, taxes] = await Promise.all([
        ctx.prisma.rate.findMany({
          where: { locationId: input.locationId, isActive: true, values: { some: { vehicleTypeId: input.vehicleTypeId } } },
          include: { values: { where: { vehicleTypeId: input.vehicleTypeId } } },
          orderBy: { code: "asc" },
        }),
        ctx.prisma.insurance.findMany({ where: applicable, orderBy: { name: "asc" } }),
        ctx.prisma.miscCharge.findMany({ where: { ...applicable, displayAtStartRental: true }, orderBy: { name: "asc" } }),
        ctx.prisma.locationTax.findMany({ where: { locationId: input.locationId, tax: { isActive: true } }, include: { tax: true } }),
      ]);

      // charges/coverages with a Min/Max days window only apply to rentals of that length (e.g. snow tires @40/D = 3–5 days)
      const days = input.returnAt ? Math.max(1, Math.ceil((+input.returnAt - +input.at) / 86_400_000)) : null;
      const fitsLength = (x: { minDays: number; maxDays: number }) => days === null || (days >= x.minDays && (x.maxDays === 0 || days <= x.maxDays));
      return {
        rates: rates
          .map((r) => {
            // value for the season containing the date, else the date-range value
            const v = r.values.find((x) => x.seasonId && seasonIds.includes(x.seasonId)) ?? r.values.find((x) => !x.seasonId);
            const inRange = r.validFor === "SEASON" ? !!v?.seasonId : (!r.effectiveDate || r.effectiveDate <= day) && (!r.endDate || r.endDate >= day);
            const n = (x: { toFixed(d: number): string } | null) => x?.toFixed(2) ?? null;
            // `values`: shown in the "Rate (i)" Rate Details dialog
            const values = { hourly: n(v?.hourly ?? null), daily: n(v?.daily ?? null), extraDaily: n(v?.extraDaily ?? null), weekly: n(v?.weekly ?? null), monthly: n(v?.monthly ?? null), fuelCharge: n(r.fuelChargePerUnit), kmHourly: v?.kmHourly ?? null, kmDaily: v?.kmAllowed ?? null, kmWeekly: v?.kmWeekly ?? null, kmMonthly: v?.kmMonthly ?? null, kmCharge: n(v?.extraKmCharge ?? r.extraKmCharge) };
            return v && inRange ? { id: r.id, code: r.code, daily: v.daily?.toFixed(2) ?? null, displayOnline: r.displayOnline, values } : null;
          })
          .filter((x): x is NonNullable<typeof x> => !!x),
        insurances: insurances.filter(fitsLength).map((i) => ({
          id: i.id, name: i.name, dailyRate: i.dailyRate.toFixed(2), deductible: i.deductible?.toFixed(2) ?? null,
          calculationBy: i.calculationBy, isDefault: i.isDefault, group: i.group,
        })),
        misc: misc.filter(fitsLength).map((m) => ({
          id: m.id, name: m.name, rate: m.rate.toFixed(2), calculationBy: m.calculationBy, group: m.group,
          isDefault: m.isDefault, multiSelect: m.multiSelectOnline, autoWhenUnderAge: m.autoWhenUnderAge, autoWhenAdditionalDriver: m.autoWhenAdditionalDriver,
        })),
        taxes: taxes
          .map(({ tax }) => ({ id: tax.id, name: tax.name, kind: tax.kind, value: tax.value.toFixed(3), perDay: tax.perDay }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    }),

  /** Live charge table for the staff forms (same engine that saves the booking). */
  preview: staffProcedure
    .input(
      z.object({
        pickupAt: z.coerce.date(),
        returnAt: z.coerce.date(),
        locationId: z.string().min(1),
        vehicleTypeId: z.string().min(1),
        rateId: z.string().nullable().optional(),
        discountType: z.enum(["PERCENT", "AMOUNT"]).nullable().optional(),
        discountValue: z.number().nullable().optional(),
        options: bookingOptionsInput,
      }),
    )
    .query(({ ctx, input }) =>
      priceBooking(ctx.prisma, { ...input, ...staffPricingOptions(input.options) }),
    ),
});
