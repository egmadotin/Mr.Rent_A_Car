import type { Prisma } from "@mrac/db";

/**
 * Settings > Copy Location Setup (LocationsCopy.aspx): copy a location's per-location setup to other locations.
 * Copies only what doesn't exist at the destination yet (same name / rate code / tax / vehicle type / weekday), so running
 * it twice adds nothing. Damage Locations, Referrals, Reasons, Regions, Body, Makes, Models, Options, Status, User Groups
 * and Seasons are shared by every location here, so there is nothing to copy for them.
 */

type Tx = Prisma.TransactionClient;
export const COPY_ITEMS = ["insurances", "miscCharges", "taxes", "rates", "paymentMethods", "rentalForms", "vehicleTypes", "hours"] as const;
export type CopyItem = (typeof COPY_ITEMS)[number];

/** A row without its identity (id, legacy id, location, timestamps), ready to create elsewhere. */
function strip<T extends Record<string, unknown>>(row: T) {
  const { id: _id, legacyId: _l, locationId: _loc, createdAt: _c, updatedAt: _u, ...rest } = row as Record<string, unknown>;
  return rest;
}

export async function copyLocationSetup(tx: Tx, input: { fromId: string; toIds: string[]; items: CopyItem[]; from?: Date | null }) {
  const counts: Record<string, number> = {};
  const add = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
  const has = (k: CopyItem) => input.items.includes(k);

  for (const toId of input.toIds.filter((x) => x !== input.fromId)) {
    // id maps (source → destination) so copied taxes point at the copied charges
    const insMap = new Map<string, string>();
    const miscMap = new Map<string, string>();

    if (has("insurances")) {
      const [src, dst] = await Promise.all([
        tx.insurance.findMany({ where: { locationId: input.fromId }, include: { vehicleTypes: true } }),
        tx.insurance.findMany({ where: { locationId: toId }, select: { id: true, name: true } }),
      ]);
      for (const i of src) {
        const same = dst.find((d) => d.name === i.name);
        if (same) {
          insMap.set(i.id, same.id);
          continue;
        }
        const { vehicleTypes, ...row } = i;
        const c = await tx.insurance.create({ data: { ...(strip(row) as Prisma.InsuranceUncheckedCreateInput), locationId: toId, vehicleTypes: { create: vehicleTypes.map((v) => ({ vehicleTypeId: v.vehicleTypeId })) } } });
        insMap.set(i.id, c.id);
        add("Insurances");
      }
    }

    if (has("miscCharges")) {
      const [src, dst] = await Promise.all([
        tx.miscCharge.findMany({ where: { locationId: input.fromId }, include: { vehicleTypes: true } }),
        tx.miscCharge.findMany({ where: { locationId: toId }, select: { id: true, name: true } }),
      ]);
      for (const m of src) {
        const same = dst.find((d) => d.name === m.name);
        if (same) {
          miscMap.set(m.id, same.id);
          continue;
        }
        const { vehicleTypes, ...row } = m;
        const c = await tx.miscCharge.create({ data: { ...(strip(row) as Prisma.MiscChargeUncheckedCreateInput), locationId: toId, vehicleTypes: { create: vehicleTypes.map((v) => ({ vehicleTypeId: v.vehicleTypeId })) } } });
        miscMap.set(m.id, c.id);
        add("Miscellaneous Charges");
      }
    }

    if (has("taxes")) {
      const [src, dst] = await Promise.all([tx.locationTax.findMany({ where: { locationId: input.fromId } }), tx.locationTax.findMany({ where: { locationId: toId }, select: { taxId: true } })]);
      for (const t of src.filter((x) => !dst.some((d) => d.taxId === x.taxId))) {
        const row = strip(t) as Prisma.LocationTaxUncheckedCreateInput;
        await tx.locationTax.create({
          data: {
            ...row,
            locationId: toId,
            // "Apply to" picks of this location's charges become the destination's copies (dropped when not copied)
            miscChargeIds: t.miscChargeIds.map((id) => miscMap.get(id)).filter((x): x is string => !!x),
            insuranceIds: t.insuranceIds.map((id) => insMap.get(id)).filter((x): x is string => !!x),
          },
        });
        add("Taxes");
      }
    }

    if (has("rates")) {
      const [src, dst] = await Promise.all([
        tx.rate.findMany({
          where: { locationId: input.fromId, ...(input.from ? { OR: [{ endDate: null }, { endDate: { gte: input.from } }] } : {}) },
          include: { values: true, seasons: true },
        }),
        tx.rate.findMany({ where: { locationId: toId }, select: { code: true } }),
      ]);
      for (const r of src.filter((x) => !dst.some((d) => d.code === x.code))) {
        const { values, seasons, ...row } = r;
        await tx.rate.create({
          data: {
            ...(strip(row) as Prisma.RateUncheckedCreateInput),
            locationId: toId,
            values: { create: values.map(({ rateId: _r, ...v }) => strip(v) as Omit<Prisma.RateValueUncheckedCreateInput, "rateId">) },
            seasons: { create: seasons.map((s) => ({ seasonId: s.seasonId })) },
          },
        });
        add("Rates");
      }
    }

    if (has("paymentMethods")) {
      const [src, dst] = await Promise.all([tx.locationPaymentMethod.findMany({ where: { locationId: input.fromId } }), tx.locationPaymentMethod.findMany({ where: { locationId: toId }, select: { name: true } })]);
      for (const p of src.filter((x) => !dst.some((d) => d.name === x.name))) {
        await tx.locationPaymentMethod.create({ data: { ...(strip(p) as Prisma.LocationPaymentMethodUncheckedCreateInput), locationId: toId } });
        add("Payment Methods");
      }
      const from = await tx.location.findUniqueOrThrow({ where: { id: input.fromId }, select: { defaultPaymentMethod: true } });
      const to = await tx.location.findUniqueOrThrow({ where: { id: toId }, select: { defaultPaymentMethod: true } });
      if (!to.defaultPaymentMethod && from.defaultPaymentMethod) await tx.location.update({ where: { id: toId }, data: { defaultPaymentMethod: from.defaultPaymentMethod } });
    }

    if (has("rentalForms")) {
      const [src, dst] = await Promise.all([tx.documentTemplate.findMany({ where: { locationId: input.fromId } }), tx.documentTemplate.findMany({ where: { locationId: toId }, select: { name: true, kind: true } })]);
      for (const t of src.filter((x) => !dst.some((d) => d.name === x.name && d.kind === x.kind))) {
        await tx.documentTemplate.create({ data: { ...(strip(t) as Prisma.DocumentTemplateUncheckedCreateInput), locationId: toId } });
        add("Rental Forms");
      }
    }

    if (has("vehicleTypes")) {
      const [src, dst] = await Promise.all([tx.vehicleTypeLocation.findMany({ where: { locationId: input.fromId } }), tx.vehicleTypeLocation.findMany({ where: { locationId: toId }, select: { vehicleTypeId: true } })]);
      for (const v of src.filter((x) => !dst.some((d) => d.vehicleTypeId === x.vehicleTypeId))) {
        await tx.vehicleTypeLocation.create({ data: { ...(strip(v) as Prisma.VehicleTypeLocationUncheckedCreateInput), locationId: toId } });
        add("Vehicle Types");
      }
    }

    if (has("hours")) {
      const [src, dst] = await Promise.all([tx.locationHours.findMany({ where: { locationId: input.fromId } }), tx.locationHours.findMany({ where: { locationId: toId }, select: { dayOfWeek: true } })]);
      for (const h of src.filter((x) => !dst.some((d) => d.dayOfWeek === x.dayOfWeek))) {
        await tx.locationHours.create({ data: { ...(strip(h) as Prisma.LocationHoursUncheckedCreateInput), locationId: toId } });
        add("Hours Of Operation");
      }
    }
  }
  return counts;
}
