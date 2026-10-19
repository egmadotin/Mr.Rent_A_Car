/**
 * Locations copied read-only from RentCentric Settings > Locations (LocationsModify.aspx) into
 * prisma/legacy/locations.json. Updates the seeded locations (matched by legacyId): real names,
 * addresses, contacts, Active and "Web Customer" (shown on the public site) flags.
 *
 *   pnpm --filter @mrac/db exec tsx prisma/import-legacy-locations.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string, string | boolean | null>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown) => v === true || v === "True";
// "604.303.0063" / "6043030095" → "604-303-0063"
const phone = (v: unknown) => {
  const s = str(v);
  const d = s?.replace(/\D/g, "") ?? "";
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : s;
};
// "RICHMOND" → "Richmond"; mixed-case values are kept as typed
const tidy = (v: unknown) => {
  const s = str(v);
  return s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
};
const coord = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 && Math.abs(n) <= max ? new Prisma.Decimal(n.toFixed(6)) : null;
};
const PROVINCE: Record<string, string> = { "British Columbia": "BC", Alberta: "AB", Ontario: "ON" };
const TZ: [RegExp, string][] = [
  [/Mountain/i, "America/Edmonton"],
  [/Pacific/i, "America/Vancouver"],
];

/** "2.99" → 2.99; blank → null */
const money = (v: unknown) => (v == null || String(v).trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

async function main() {
  const rows = JSON.parse(readFileSync(join(__dirname, "legacy/locations.json"), "utf8")) as Record<string, Row>;
  for (const [legacyId, r] of Object.entries(rows)) {
    const loc = await prisma.location.findUnique({ where: { legacyId: Number(legacyId) }, select: { id: true } });
    if (!loc) {
      console.warn(`No seeded location for legacy ${legacyId} (${r.LocationName}); skipped.`);
      continue;
    }
    // YVR keeps "*Call for Pick-up & Drop-off*" in its City field: show it as the location note instead
    const city = str(r.City);
    const cityIsNote = !!city && /call for/i.test(city);
    await prisma.location.update({
      where: { id: loc.id },
      data: {
        name: str(r.LocationName) ?? undefined,
        code: str(r.LocationCode),
        address1: str(r.Address),
        city: cityIsNote ? "Richmond" : tidy(city),
        province: PROVINCE[String(r.StateCode)] ?? str(r.StateCode),
        postal: str(r.Zip),
        country: r.CountryCode === "Canada" ? "CA" : str(r.CountryCode),
        phone: phone(r.Phone),
        fax: phone(r.Fax),
        email: str(r.Email),
        tollFree: str(r.TollFreeNumber),
        closestIntersection: str(r.txtClosestInterSection),
        closestAirport: str(r.txtClosestAirport),
        latitude: coord(r.txtLat, 90),
        longitude: coord(r.txtLon, 180),
        minimumAge: int(r.MinimumAge),
        underAge: int(r.UnderAge),
        legalName: str(r.LegalName),
        gstNumber: str(r.GSTNumber),
        quoteExpiresAfter: int(r.txtQuoteExpiresAfter) ?? 0,
        refuelPrice: money(r.txtConvenienceReFuel),
        dieselRefuelPrice: money(r.txtDieselConvenienceReFuel),
        prepaidFuelPrice: money(r.txtPrePaidFuel),
        dieselPrepaidFuelPrice: money(r.txtDieselPrePaidFuel),
        memo: str(r.Memo),
        timeZone: TZ.find(([re]) => re.test(String(r.LocationTimeZone)))?.[1] ?? undefined,
        isOffsite: /offsite/i.test(String(r.LocationName)),
        isActive: bool(r.IsActive),
        isLegacy: !bool(r.IsActive),
        displayOnline: bool(r.cbWebCustomer),
        ...(cityIsNote ? { hoursNote: city!.replace(/^\*|\*$/g, "") } : {}),
      },
    });
    console.log(`${legacyId} ${r.LocationName}: active=${bool(r.IsActive)} online=${bool(r.cbWebCustomer)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
