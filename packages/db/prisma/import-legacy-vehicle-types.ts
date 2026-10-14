/**
 * Real vehicle classes from RentCentric Settings > Vehicle Setup > Types (VehicleTypesModify.aspx),
 * copied read-only for every location into prisma/legacy/vehicle_types.json (`loc` = LocationID).
 * Photos were downloaded to apps/web/public/legacy/vehicle-types/ (file name = legacy image name,
 * lower-case, spaces → "-").
 *
 * RentCentric keeps one copy of each class per location. Here a class is one VehicleType (by name) and
 * each per-location copy is a VehicleTypeLocation (its own legacy id, photo, memo, "Web Customer" flag),
 * ordered like the public fleet page (legacy/public_fleet_order.json, scraped from mrrentacar.com/fleet).
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-vehicle-types.ts
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string, string | boolean | null | string[] | number> & { legacyId: string; loc: number; image: string | null; sipp: string[] };

const num = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() && !/^please select$/i.test(v.trim()) ? v.trim() : null);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0, 10)}T00:00:00Z`) : null);

const IMG_DIR = join(__dirname, "../../../apps/web/public/legacy/vehicle-types");
const files = existsSync(IMG_DIR) ? readdirSync(IMG_DIR) : [];
function imageKey(legacyImage: string | null) {
  if (!legacyImage) return null;
  const id = legacyImage.match(/^VehicleTypeID(\d+)/i)?.[1];
  const f = files.find((x) => x.toLowerCase().startsWith(`vehicletypeid${id}`));
  return f ? `/legacy/vehicle-types/${f}` : null;
}

async function main() {
  const rows = JSON.parse(readFileSync(join(__dirname, "legacy/vehicle_types.json"), "utf8")) as Row[];
  // Same classes exist per location; Surrey (121) is the reference, YYC then the others fill gaps.
  const pref = (r: Row) => (r.loc === 121 ? 0 : r.loc === 120 ? 1 : 2);
  const byName = new Map<string, Row>();
  for (const r of [...rows].sort((a, b) => pref(a) - pref(b))) {
    const name = str(r.Description);
    if (!name) continue;
    const prev = byName.get(name);
    if (!prev) byName.set(name, r);
    else if (!prev.image && r.image) byName.set(name, { ...prev, image: r.image });
  }

  let n = 0;
  for (const [name, r] of byName) {
    const small = num(r.SmallBags) ?? 0;
    const large = num(r.LargeBags) ?? 0;
    const data = {
      code: str(r.VehicleTypeCode),
      description: str(r.Memo) ?? undefined, // keep the public-site description when the ERP memo is empty
      seats: num(r.ddlSeats),
      doors: num(r.ddlDoors),
      smallBags: small,
      largeBags: large,
      luggage: small + large || undefined, // keep the public-site value when the ERP has no bag counts
      transmission: str(r.Transmission),
      minimumAge: num(r.txtMinimumAge) || null,
      deposit: num(r.TextBoxDeposit) ? new Prisma.Decimal(String(r.TextBoxDeposit)) : null,
      depositType: str(r.ddlDepositType),
      depositRequiredAtReservation: r.cbPayDepositRequiredAtReservation === true,
      alwaysAvailable: r.CheckboxAlwaysAvailable === true,
      airConditioner: r.CkAirConditioner === true,
      specUrl: str(r.TxtVehicleSpecURL),
      videoUrl: str(r.TxtVehicleYouTubeVideoURL),
      sippCode: r.sipp?.length ? r.sipp.join(", ") : null,
      effectiveDate: day(r.StartDate),
      endDate: day(r.EndDate),
      displayOnline: r.CheckBoxWebCustomer === true,
      imageKey: imageKey(r.image),
      legacyId: Number(r.legacyId),
    };
    await prisma.vehicleType.upsert({ where: { name }, update: data, create: { name, ...data } });
    n++;
  }
  // classes RentCentric has no photo for: use the photo mrrentacar.com shows for that class
  const pub = join(__dirname, "legacy/public_fleet_images.json");
  if (existsSync(pub))
    for (const [name, key] of Object.entries(JSON.parse(readFileSync(pub, "utf8")) as Record<string, string>))
      await prisma.vehicleType.updateMany({ where: { name, imageKey: null }, data: { imageKey: key } });
  // classes without a photo borrow one from a class with the same description (YYC "7-Passenger Minivan" = "VAN 7P Minivan")
  const types = await prisma.vehicleType.findMany({ select: { id: true, description: true, imageKey: true } });
  for (const t of types.filter((t) => !t.imageKey && t.description)) {
    const twin = types.find((x) => x.imageKey && x.description?.toLowerCase() === t.description!.toLowerCase());
    if (twin) await prisma.vehicleType.update({ where: { id: t.id }, data: { imageKey: twin.imageKey } });
  }

  // per-location copies
  const order = JSON.parse(readFileSync(join(__dirname, "legacy/public_fleet_order.json"), "utf8")) as Record<string, number>;
  // the photo mrrentacar.com shows on that location's fleet card (not always on the ERP form)
  const sitePhoto = JSON.parse(readFileSync(join(__dirname, "legacy/public_fleet_type_images.json"), "utf8")) as Record<string, string>;
  const locations = new Map((await prisma.location.findMany({ select: { id: true, legacyId: true } })).map((l) => [l.legacyId, l.id]));
  const typeIds = new Map((await prisma.vehicleType.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
  let m = 0;
  for (const r of rows) {
    const name = str(r.Description);
    const locationId = locations.get(r.loc);
    const vehicleTypeId = name ? typeIds.get(name) : undefined;
    if (!locationId || !vehicleTypeId) continue;
    const data = {
      legacyId: Number(r.legacyId),
      description: str(r.Memo),
      imageKey: imageKey(r.image) ?? sitePhoto[r.legacyId] ?? null,
      displayOnline: r.CheckBoxWebCustomer === true,
      sortOrder: order[r.legacyId] ?? 1000,
      // every class listed for the location is offered; the public site ignores its Start/End dates
      isActive: true,
    };
    await prisma.vehicleTypeLocation.upsert({
      where: { vehicleTypeId_locationId: { vehicleTypeId, locationId } },
      update: data,
      create: { vehicleTypeId, locationId, ...data },
    });
    m++;
  }
  // classes still without a main photo take one of their per-location photos
  for (const t of await prisma.vehicleType.findMany({ where: { imageKey: null }, select: { id: true, locations: { where: { imageKey: { not: null } }, select: { imageKey: true }, take: 1 } } }))
    if (t.locations[0]) await prisma.vehicleType.update({ where: { id: t.id }, data: { imageKey: t.locations[0].imageKey } });
  console.log(`Imported ${n} vehicle types (${[...byName.values()].filter((r) => imageKey(r.image)).length} with photos), ${m} per-location copies.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
