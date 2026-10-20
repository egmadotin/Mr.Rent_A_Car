import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@mrac/db";
import { router, publicProcedure } from "../trpc";
import { onlineOptions, periodTotal, pickOnlineRate, priceBooking } from "../lib/pricing";
import { withBookingGuard } from "../lib/errors";
import { cardOf, requireStripe, stripeGateway } from "../lib/payments";

/**
 * Customer-facing surface: public booking site today, Expo app later.
 * Keep inputs/outputs stable — the mobile app will depend on them.
 * Never return internal fields (costs, staff names, legacy ids).
 */

const searchInput = z
  .object({
    pickupLocationId: z.string().min(1, "Choose a pick-up location"),
    returnLocationId: z.string().min(1, "Choose a return location"),
    pickupAt: z.coerce.date({ invalid_type_error: "Choose a pick-up date" }),
    returnAt: z.coerce.date({ invalid_type_error: "Choose a return date" }),
    promoCode: z.string().trim().max(40).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.returnAt <= v.pickupAt) ctx.addIssue({ code: "custom", path: ["returnAt"], message: "Return must be after pick-up" });
    if (v.pickupAt < new Date(Date.now() - 60 * 60_000)) ctx.addIssue({ code: "custom", path: ["pickupAt"], message: "Pick-up can't be in the past" });
  });

const publicType = { id: true, name: true, description: true, seats: true, luggage: true, doors: true, imageKey: true } as const;

const optionsInput = {
  vehicleTypeId: z.string().min(1),
  insuranceId: z.string().optional().nullable(),
  miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.number().int().min(0).max(10) })).default([]),
};

/** The online price of a booking (same rate pick and charges as the quote and the reservation). */
async function priceOnline(
  db: Prisma.TransactionClient,
  input: { search: z.infer<typeof searchInput>; vehicleTypeId: string; insuranceId?: string | null; miscCharges: { miscChargeId: string; quantity: number }[]; birthDate: Date },
) {
  const s = input.search;
  const rate = await pickOnlineRate(db, { locationId: s.pickupLocationId, vehicleTypeId: input.vehicleTypeId, pickupAt: s.pickupAt, returnAt: s.returnAt });
  if (!rate) throw new TRPCError({ code: "BAD_REQUEST", message: "That vehicle class isn't available online for these dates. Please call us." });
  const priced = await priceBooking(db, {
    online: true,
    pickupAt: s.pickupAt,
    returnAt: s.returnAt,
    locationId: s.pickupLocationId,
    vehicleTypeId: input.vehicleTypeId,
    rateId: rate.id,
    insuranceId: input.insuranceId,
    miscCharges: input.miscCharges,
    driverAge: ageAt(input.birthDate, s.pickupAt),
  });
  return { rate, priced };
}

const cents = (d: Prisma.Decimal) => Math.round(Number(d) * 100);

export const customerRouter = router({
  /** Whether step 3 shows the card field (Settings > Payment Gateway), and Stripe's publishable key. */
  paymentConfig: publicProcedure.query(async ({ ctx }) => {
    const g = await ctx.prisma.paymentGateway.findUnique({ where: { provider: "STRIPE" } });
    return g?.isActive && g.publishableKey && g.secretKeyEnc ? { enabled: true as const, publishableKey: g.publishableKey, onlineMode: g.onlineMode } : { enabled: false as const };
  }),

  /**
   * Step 3, before Reserve: a Stripe SetupIntent (keep the card for the counter) or a manual-capture PaymentIntent
   * (hold the booking total), for the browser to confirm with Stripe's card field. Card numbers never reach our server.
   */
  prepareCard: publicProcedure
    .input(z.object({ search: searchInput, ...optionsInput, birthDate: z.coerce.date(), email: z.string().trim().email("Enter a valid email"), name: z.string().trim().max(160) }))
    .mutation(async ({ ctx, input }) => {
      const g = await requireStripe(ctx.prisma);
      const customer = await g.stripe.customers.create({ email: input.email, name: input.name || undefined });
      if (g.onlineMode === "AUTHORIZE") {
        const { priced } = await priceOnline(ctx.prisma, input);
        const pi = await g.stripe.paymentIntents.create({
          amount: cents(priced.total),
          currency: "cad",
          capture_method: "manual",
          customer: customer.id,
          setup_future_usage: "off_session",
          payment_method_types: ["card"],
          description: "Mr Rent A Car online reservation (authorization)",
        });
        return { kind: "payment" as const, clientSecret: pi.client_secret!, intentId: pi.id };
      }
      const si = await g.stripe.setupIntents.create({ customer: customer.id, usage: "off_session", payment_method_types: ["card"] });
      return { kind: "setup" as const, clientSecret: si.client_secret!, intentId: si.id };
    }),


  /** Locations offered on the public site (RentCentric "Web Customer"). */
  locations: publicProcedure.query(({ ctx }) =>
    ctx.prisma.location.findMany({
      where: { isActive: true, displayOnline: true },
      orderBy: { name: "asc" },
      select: {
        timeZone: true,
        id: true, name: true, isOffsite: true, address1: true, city: true, province: true, postal: true,
        phone: true, fax: true, email: true, hoursNote: true,
        hours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, opensAt: true, closesAt: true, isClosed: true } },
      },
    }),
  ),

  /** Fleet page: the classes a location shows online, in its own order, with its own photo / "or similar" text. */
  fleet: publicProcedure.input(z.object({ locationId: z.string().optional() })).query(async ({ ctx, input }) => {
    if (!input.locationId) {
      const [types, mins] = await Promise.all([
        ctx.prisma.vehicleType.findMany({ where: { isActive: true, displayOnline: true }, orderBy: { sortOrder: "asc" }, select: publicType }),
        // "from $X/day": the lowest daily price among the rates offered online
        ctx.prisma.rateValue.groupBy({ by: ["vehicleTypeId"], where: { daily: { gt: 0 }, rate: { isActive: true, displayOnline: true } }, _min: { daily: true } }),
      ]);
      const from = new Map(mins.map((m) => [m.vehicleTypeId, m._min.daily?.toFixed(2) ?? null]));
      return types.map((t) => ({ ...t, fromDaily: from.get(t.id) ?? null }));
    }
    const rows = await ctx.prisma.vehicleTypeLocation.findMany({
      where: { locationId: input.locationId, displayOnline: true, isActive: true, vehicleType: { isActive: true } },
      orderBy: { sortOrder: "asc" },
      select: { description: true, imageKey: true, vehicleType: { select: publicType } },
    });
    return rows.map((r) => ({ ...r.vehicleType, description: r.description ?? r.vehicleType.description, imageKey: r.imageKey ?? r.vehicleType.imageKey }));
  }),

  /** Makes of the vehicles in service (home page "Trusted brands"). */
  brands: publicProcedure.query(async ({ ctx }) =>
    (await ctx.prisma.vehicleMake.findMany({ where: { vehicles: { some: { isActive: true } } }, orderBy: { name: "asc" }, select: { name: true } })).map((m) => m.name),
  ),

  /** Booking step 2 ("Select Vehicle"): priced classes for the search. */
  search: publicProcedure.input(searchInput).query(async ({ ctx, input }) => {
    const types = await ctx.prisma.vehicleType.findMany({
      where: {
        isActive: true,
        // only classes this location shows online (RentCentric per-location "Web Customer")
        locations: { some: { locationId: input.pickupLocationId, isActive: true, displayOnline: true } },
        rateValues: { some: { rate: { locationId: input.pickupLocationId, isActive: true, displayOnline: true } } },
      },
      select: { ...publicType, locations: { where: { locationId: input.pickupLocationId }, select: { sortOrder: true, description: true, imageKey: true } } },
    });
    // the location's own order, photo and "or similar" text
    types.sort((a, b) => (a.locations[0]?.sortOrder ?? 0) - (b.locations[0]?.sortOrder ?? 0));
    for (const t of types) {
      const at = t.locations[0];
      if (at?.description) t.description = at.description;
      if (at?.imageKey) t.imageKey = at.imageKey;
    }
    const results = [];
    for (const t of types) {
      const rate = await pickOnlineRate(ctx.prisma, { locationId: input.pickupLocationId, vehicleTypeId: t.id, pickupAt: input.pickupAt, returnAt: input.returnAt });
      if (!rate) continue;
      const priced = await priceBooking(ctx.prisma, {
        online: true,
        pickupAt: input.pickupAt,
        returnAt: input.returnAt,
        locationId: input.pickupLocationId,
        vehicleTypeId: t.id,
        rateId: rate.id,
        // `total` = rental + default charges + tax (estimate); the headline `price` below is the rental only, like mrrentacar.com
      });
      const free = await ctx.prisma.vehicle.count({
        where: {
          isActive: true,
          vehicleTypeId: t.id,
          rentalLocationId: input.pickupLocationId,
          status: { in: ["AVAILABLE", "ON_RENT"] },
          blocks: { none: { startsAt: { lt: input.returnAt }, endsAt: { gt: input.pickupAt } } },
        },
      });
      const km = priced.lines.find((l) => l.kind === "MILEAGE");
      const { locations: _at, ...vehicleType } = t;
      results.push({
        vehicleType,
        // headline price as mrrentacar.com shows it: the rental (time) charge only
        price: priced.lines.filter((l) => l.kind === "TIME").reduce((a, l) => a + Number(l.total), 0).toFixed(2),
        total: priced.total.toFixed(2),
        days: priced.days + (priced.hours > 0 ? 1 : 0),
        kmIncluded: km ? Number(km.units) : null,
        extraKmCharge: (priced.extraKmCharge ?? rate.extraKmCharge).toFixed(2),
        rateId: rate.id,
        available: free > 0,
        lines: priced.lines.map((l) => ({ name: l.name, units: Number(l.units), total: l.total.toFixed(2), kind: l.kind })),
      });
    }
    return results;
  }),

  /** Booking step 3 ("Rental Options"): protections (pick one) and extras, priced for this booking. */
  options: publicProcedure.input(searchInput.and(z.object({ vehicleTypeId: z.string().min(1) }))).query(async ({ ctx, input }) => {
    const { insurances, misc } = await onlineOptions(ctx.prisma, { locationId: input.pickupLocationId, vehicleTypeId: input.vehicleTypeId, at: input.pickupAt });
    const days = Math.max(1, Math.ceil((+input.returnAt - +input.pickupAt) / 86_400_000));
    return {
      protections: insurances.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        image: i.imageKey,
        deductible: i.deductible?.toFixed(2) ?? null,
        isDefault: i.isDefault,
        total: (i.calculationBy === "FLAT" ? i.dailyRate : periodTotal({ rate: i.dailyRate, weeklyRate: i.weeklyRate, monthlyRate: i.monthlyRate, valuePricing: i.valuePricing }, days)).toFixed(2),
      })),
      extras: misc.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        image: m.imageKey,
        /** pre-checked and locked online */
        included: m.isDefault || m.isMandatory,
        multiSelect: m.multiSelectOnline && !m.isDefault,
        group: m.group,
        percent: m.calculationBy === "PERCENT" ? m.rate.toFixed(2) : null,
        total: m.calculationBy === "PERCENT" ? null : (m.calculationBy === "FLAT" ? m.rate : periodTotal(m, days)).toFixed(2),
      })),
    };
  }),

  /** Live total for the chosen protection + extras (summary panel on the options/details steps). */
  quote: publicProcedure
    .input(
      searchInput.and(
        z.object({
          vehicleTypeId: z.string().min(1),
          insuranceId: z.string().optional().nullable(),
          miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.number().int().min(0).max(10) })).default([]),
          driverAge: z.number().int().min(16).max(120).optional().nullable(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const rate = await pickOnlineRate(ctx.prisma, { locationId: input.pickupLocationId, vehicleTypeId: input.vehicleTypeId, pickupAt: input.pickupAt, returnAt: input.returnAt });
      if (!rate) return null;
      const priced = await priceBooking(ctx.prisma, {
        online: true,
        pickupAt: input.pickupAt,
        returnAt: input.returnAt,
        locationId: input.pickupLocationId,
        vehicleTypeId: input.vehicleTypeId,
        rateId: rate.id,
        insuranceId: input.insuranceId,
        miscCharges: input.miscCharges,
        driverAge: input.driverAge,
      });
      // zero-cost charges that aren't "Display Online" (e.g. under-age / driver fees not applying) stay off the summary
      const hidden = new Set(
        (await ctx.prisma.miscCharge.findMany({ where: { id: { in: priced.lines.map((l) => l.miscChargeId).filter((x): x is string => !!x) }, displayOnline: false }, select: { id: true } })).map((m) => m.id),
      );
      return {
        // headline price as mrrentacar.com shows it: the rental (time) charge only
        price: priced.lines.filter((l) => l.kind === "TIME").reduce((a, l) => a + Number(l.total), 0).toFixed(2),
        total: priced.total.toFixed(2),
        lines: priced.lines
          .filter((l) => l.kind !== "MILEAGE" && !(l.miscChargeId && hidden.has(l.miscChargeId) && l.total.isZero()))
          .map((l) => ({ name: l.name, total: l.total.toFixed(2), kind: l.kind, sortOrder: l.sortOrder })),
      };
    }),

  /**
   * Step 3 "Reserve": creates a TENTATIVE reservation (channel "Website") for staff to confirm. With card payments on
   * (Settings > Payment Gateway), the card confirmed by Stripe is saved (and, in AUTHORIZE mode, the hold recorded).
   */
  requestReservation: publicProcedure
    .input(
      z.object({
        search: searchInput,
        vehicleTypeId: z.string().min(1),
        insuranceId: z.string().optional().nullable(),
        miscCharges: z.array(z.object({ miscChargeId: z.string(), quantity: z.number().int().min(0).max(10) })).default([]),
        firstName: z.string().trim().min(1, "First name is required").max(80),
        lastName: z.string().trim().min(1, "Last name is required").max(80),
        email: z.string().trim().email("Enter a valid email"),
        phone: z.string().trim().min(7, "Enter a phone number").max(30),
        /** mrrentacar.com "Customer Information": every field is required except Special Request */
        birthDate: z.coerce.date({ invalid_type_error: "Birth Day is required" }),
        address: z.string().trim().min(1, "Address is required").max(200),
        city: z.string().trim().min(1, "City is required").max(80),
        province: z.string().trim().min(1, "State/Province is required").max(80),
        country: z.string().trim().min(1, "Country is required").max(80),
        postal: z.string().trim().min(1, "Zip/Postal Code is required").max(20),
        licenseNumber: z.string().trim().min(1, "Driver License Number is required").max(40),
        licenseExpiry: z.coerce.date({ invalid_type_error: "Driver's License Exp. is required" }),
        licenseProvince: z.string().trim().min(1, "Driver's License State is required").max(80),
        notes: z.string().trim().max(1000).optional(),
        acceptPolicy: z.literal(true, { errorMap: () => ({ message: "Please accept the rental policy" }) }),
        /** the Stripe Setup/Payment Intent confirmed in the browser (required when card payments are on) */
        stripeIntentId: z.string().optional(),
        /** honeypot — real users never fill it */
        website: z.string().max(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // card first (outside the DB transaction): the confirmed intent's card, and the held amount when authorizing
      const g = await stripeGateway(ctx.prisma);
      let card: (Awaited<ReturnType<typeof cardOf>> & { paymentMethodId: string; heldCents: number | null; intentId: string }) | null = null;
      if (g) {
        if (!input.stripeIntentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Please enter your card details." });
        const isPayment = input.stripeIntentId.startsWith("pi_");
        const intent = isPayment ? await g.stripe.paymentIntents.retrieve(input.stripeIntentId) : await g.stripe.setupIntents.retrieve(input.stripeIntentId);
        const ok = isPayment ? intent.status === "requires_capture" : intent.status === "succeeded";
        const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
        if (!ok || !pm) throw new TRPCError({ code: "BAD_REQUEST", message: "Your card wasn't confirmed. Please try again." });
        card = { ...(await cardOf(g.stripe, pm)), paymentMethodId: pm, heldCents: isPayment ? (intent as { amount: number }).amount : null, intentId: intent.id };
      }

      return withBookingGuard(() =>
        ctx.prisma.$transaction(async (tx) => {
          const s = input.search;
          const { rate, priced } = await priceOnline(tx, input);
          if (card?.heldCents != null && card.heldCents !== cents(priced.total))
            throw new TRPCError({ code: "BAD_REQUEST", message: "The price changed while you were booking. Please go back and try again." });

          // Link to an existing customer only on an exact email match; otherwise create one.
          let customer = await tx.customer.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, orderBy: { updatedAt: "desc" } });
          if (customer?.isUndesired) throw new TRPCError({ code: "BAD_REQUEST", message: "We can't complete this booking online. Please call us." });
          const profile = {
            birthDate: input.birthDate,
            address1: input.address,
            city: input.city,
            province: input.province,
            country: input.country,
            postal: input.postal,
            licenseNumber: input.licenseNumber,
            licenseExpiry: input.licenseExpiry,
            licenseProvince: input.licenseProvince,
          };
          if (customer) customer = await tx.customer.update({ where: { id: customer.id }, data: { phone: input.phone, ...profile } });
          customer ??= await tx.customer.create({
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email,
              phone: input.phone,
              defaultLocationId: s.pickupLocationId,
              enteredLocationId: s.pickupLocationId,
              registrationChannel: "Website",
              ...profile,
            },
          });

          const notes = [
            `Age: ${ageAt(input.birthDate, s.pickupAt)}`,
            s.promoCode ? `Promo code: ${s.promoCode}` : null,
            input.notes ? `Notes: ${input.notes}` : null,
          ].filter(Boolean).join("\n");

          const r = await tx.reservation.create({
            data: {
              status: "TENTATIVE",
              customerId: customer.id,
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email,
              phone: input.phone,
              locationId: s.pickupLocationId,
              pickupLocationId: s.pickupLocationId,
              returnLocationId: s.returnLocationId,
              pickupAt: s.pickupAt,
              returnAt: s.returnAt,
              vehicleTypeId: input.vehicleTypeId,
              rateId: rate.id,
              customerNotes: notes,
              reservationChannel: "Website",
              chargeLines: { create: priced.lines },
            },
          });
          await tx.auditLog.create({ data: { entityType: "Reservation", entityId: r.id, field: "ReservationNumber", newValue: String(r.number) } });
          if (card) {
            const cc = await tx.creditCard.create({
              data: { customerId: customer.id, description: "Online reservation", brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear, holderName: card.holderName, processorToken: card.paymentMethodId },
            });
            if (card.heldCents != null)
              await tx.payment.create({
                data: {
                  reservationId: r.id,
                  customerId: customer.id,
                  method: CARD_METHOD[card.brand.toLowerCase()] ?? "INTERNAL",
                  transactionType: "AUTHORIZATION",
                  amount: priced.total,
                  creditCardId: cc.id,
                  cardLast4: card.last4,
                  transactionCode: card.intentId,
                  paymentDetail: `Stripe ${card.brand}`,
                },
              });
          }
          return { reservationNumber: r.number, total: priced.total.toFixed(2) };
        }),
      );
    }),
});

const CARD_METHOD: Record<string, "VISA" | "MASTERCARD" | "AMEX"> = { visa: "VISA", mastercard: "MASTERCARD", amex: "AMEX" };

/** Full years between a birth date and the pick-up date. */
function ageAt(birth: Date, at: Date) {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}
