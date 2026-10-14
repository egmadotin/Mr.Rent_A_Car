/**
 * Dev seed.
 *
 * Reference data (locations, vehicle types, makes, pick-lists, misc charges) is copied from the
 * live RentCentric screens so dev looks like production. Everything person- or booking-related
 * is FAKE test data. Real data arrives via the migration import, never via this file.
 *
 * Dev staff login (local only):
 *   email:    staff@mrac.test
 *   password: Dev-Counter-2026!
 */
import { PrismaClient, LookupKind, Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const D = (n: number | string) => new Prisma.Decimal(n);

const DEV_STAFF = { email: "staff@mrac.test", password: "Dev-Counter-2026!", name: "Dev Staff" };

// ── Locations (legacyId = RentCentric LocationID where known) ──────────────────
// Public contact details and hours from mrrentacar.com/our-locations. Flags and names match RentCentric
// Settings > Locations (import-legacy-locations.ts fills in the rest): Coquitlam is the one inactive location;
// Surrey is active but not offered on the public site.
const LOCATIONS = [
  { key: "surrey", legacyId: 121, name: "Surrey BC - Mr Rent A Car", address1: "10165 Beaver Dr", city: "Surrey", province: "BC", postal: "V6X 1X7", country: "CA", phone: "778-827-1119", isActive: true, displayOnline: false },
  { key: "coquitlam", legacyId: 119, name: "Coquitlam - 323 North Road, V3K 3V8", address1: "323 North Road", city: "Coquitlam", province: "BC", postal: "V3K 3V8", isActive: false, isLegacy: true, displayOnline: false },
  { key: "yyc", legacyId: 120, name: "YYC - Calgary International Airport Offsite", address1: "57 Freeport Cres NE", city: "Calgary", province: "AB", postal: "T3J 3P9", phone: "587-777-1183", isOffsite: true, isActive: true, displayOnline: true, timeZone: "America/Edmonton" },
  { key: "richmond", legacyId: 116, name: "Richmond - 7780 River Road, V6X 1X7", address1: "7780 River Road", city: "Richmond", province: "BC", postal: "V6X 1X7", phone: "604-303-0063", isActive: true, displayOnline: true },
  { key: "burnaby", legacyId: 117, name: "Burnaby - 6322 Kingsway, V5E 1C5", address1: "6322 Kingsway", city: "Burnaby", province: "BC", postal: "V5E 1C5", phone: "604-872-7772", isActive: true, displayOnline: true },
  { key: "vanAdmin", legacyId: 118, name: "Vancouver - Admin Office - 838 Drake St", address1: "838 Drake St", city: "Vancouver", province: "BC", postal: "V6Z 1C1", phone: "604-876-7777", isActive: true, displayOnline: true },
  { key: "yvr", legacyId: 126, name: "YVR - Vancouver International Airport Offsite", address1: "Vancouver International Airport - 7780 River Road", city: "Richmond", province: "BC", postal: "V6X 1X7", phone: "604-273-0099", isOffsite: true, isActive: true, displayOnline: true },
] as const;

const SHARED = { fax: "604-303-0095", email: "info@mrrentacar.com", hoursNote: "24 hour key drop box" };

// [dayOfWeek 0=Sun … 6=Sat, opens, closes] — null = closed
type H = [number, string | null, string | null];
const wk = (mf: [string, string], sat: [string, string] | null, sun: [string, string] | null): H[] => [
  [0, sun?.[0] ?? null, sun?.[1] ?? null],
  ...[1, 2, 3, 4, 5].map((d): H => [d, mf[0], mf[1]]),
  [6, sat?.[0] ?? null, sat?.[1] ?? null],
];
const HOURS: Record<string, H[]> = {
  surrey: wk(["09:00", "18:00"], ["09:00", "18:00"], null),
  yyc: wk(["08:30", "18:00"], ["09:30", "17:00"], null),
  richmond: wk(["08:30", "18:30"], ["08:30", "18:30"], ["09:00", "17:00"]),
  burnaby: wk(["08:30", "18:00"], ["09:00", "18:00"], ["09:00", "15:00"]),
  vanAdmin: wk(["08:30", "18:00"], ["09:00", "17:00"], ["09:00", "15:00"]),
  yvr: wk(["08:30", "18:30"], ["08:30", "18:30"], ["09:00", "17:00"]),
};

// Public class specs from mrrentacar.com (fleet + select-vehicle pages).
const TYPE_SPECS: Record<string, { seats: number; luggage: number; doors: number; description: string }> = {
  Standard: { seats: 5, luggage: 2, doors: 4, description: "Honda Civic, Toyota Corolla, Nissan Sentra, or Similar" },
  "Full Size": { seats: 5, luggage: 2, doors: 4, description: "Nissan Altima, Toyota Camry, Honda Accord, or Similar" },
  "Compact SUV": { seats: 5, luggage: 2, doors: 5, description: "Hyundai Kona, Nissan Kicks, Mazda CX-30, or Similar" },
  "Midsize SUV": { seats: 5, luggage: 2, doors: 5, description: "Nissan Rogue, Toyota Rav4, Honda CR-V, Mazda CX-5, or Similar" },
  "Standard SUV": { seats: 5, luggage: 2, doors: 5, description: "Jeep Grand Cherokee, Toyota Venza, Chevrolet Blazer, Honda Passport, or Similar" },
  "Premium SUV": { seats: 7, luggage: 3, doors: 5, description: "7 or 8 Passenger Chevrolet Suburban, GMC Yukon, or Similar" },
  "VAN 7P Minivan": { seats: 7, luggage: 5, doors: 4, description: "Chrysler Grand Caravan 7-Passenger or Similar" },
  "VAN 8P Minivan": { seats: 8, luggage: 5, doors: 4, description: "Honda Odyssey, Toyota Sienna, Kia Carnival, or Similar" },
  "7-Passenger Minivan": { seats: 7, luggage: 2, doors: 4, description: "Chrysler Grand Caravan 7-Passenger or Similar" },
  "8-Passenger Minivan": { seats: 8, luggage: 3, doors: 4, description: "Honda Odyssey, Toyota Sienna, Kia Carnival, or Similar" },
  "Mercedes EQB": { seats: 5, luggage: 0, doors: 4, description: "Mercedes-Benz EQB Electric SUV" },
  "Mystery Car": { seats: 4, luggage: 2, doors: 2, description: "2 or 4 Doors, Up to 5 Seats, Automatic" },
  "Model 3": { seats: 5, luggage: 4, doors: 4, description: "Tesla Model 3 Full Electric Sedan" },
  Economy: { seats: 4, luggage: 3, doors: 2, description: "Chevrolet Spark 2 Doors or 4 Doors" },
  Compact: { seats: 5, luggage: 3, doors: 4, description: "Kia Rio 4 Doors or similar" },
  Intermediate: { seats: 5, luggage: 2, doors: 4, description: "Kia Forte or Similar" },
};

// Vehicle "Type" list from the live Add New Vehicle form.
const VEHICLE_TYPES = [
  "AUDI Q7", "Autocycle", "BMW 3-Series", "BMW 4 Series Cab", "BMW 435i Cab", "BMW X1", "Cargo Van", "Compact",
  "Compact SUV", "Convertible", "Cube Truck", "Dodge Challenger", "Dodge Charger SP SRT", "Economy", "Full Size",
  "Full Sport Utility", "Full SUV", "Honda Civic Type R", "Intermediate", "Intermediate Electric", "iX xDrive",
  "Jeep Wrangler", "Lexus RX Series", "LUX Luxury Small Car", "Luxury Full Car", "Luxury Full SUV",
  "Luxury Premium Car", "Luxury Premium SUV", "Luxury Small Car", "Luxury Standard Car", "Luxury Standard SUV",
  "Luxury Standard SUV BMW X3,Mercedes GLC, Audi Q5", "Managers Choice", "MB B-Class", "MB C43 AMG", "MB C43C AMG",
  "MB C-Class", "MB CLA-Class", "MB GLC Class", "MB GLC-Class", "MB GLE Class", "MB GLE43C AMG", "Mercedes EQB",
  "Midsize SUV", "MINI COOPER SUV", "Minivan", "Minivan 8", "Minivan 8 Prem", "Model 3", "Model X", "Model Y",
  "Mystery Car", "Pickup Truck", "Premium", "Premium Sport Utility", "Premium SUV", "Range Rover Sport", "REPAIR",
  "Standard", "Standard Sport Utility", "Standard SUV", "Tesla", "TRK Cargo Van", "TRK Pickup Truck",
  "VAN 15 Passenger Minibus", "VAN 7P Minivan", "VAN 8P Minivan", "VAN 8P Prem Minivan",
  // YYC (Calgary) names for the minivan classes
  "7-Passenger Minivan", "8-Passenger Minivan",
];

const MAKES = [
  "ACURA", "AUDI", "BMW", "BUICK", "CADILLAC", "CHEVROLET", "CHRYSLER", "DAEWOO", "DODGE", "FIAT", "FORD", "GMC",
  "HONDA", "HYUNDAI", "INFINITI", "ISUZU", "JAGUAR", "JEEP", "KIA", "LAND ROVER", "LEXUS", "LINCOLN", "MAZDA",
  "MERCEDES-BENZ", "MERCURY", "MINI", "MITSUBISHI", "NISSAN", "OLDSMOBILE", "PONTIAC", "PORSCHE", "RAM", "SATURN",
  "SUBARU", "TOYOTA", "VOLKSWAGEN", "VOLVO",
];

const LOOKUPS: Record<LookupKind, string[]> = {
  VEHICLE_BODY: ["15 Pass. Van", "ATV", "Car", "Dirt Bike", "Minivan", "Snowmobile", "Street Motorcycle", "SUV", "Trailer", "Truck", "Water Craft"],
  FUEL_TYPE: ["Gas", "Diesel", "Petrol", "Electric", "Bicycle", "Regular"],
  VEHICLE_OPTION: [
    "Game System X-box", "Game Systems 360", "Game Systems Playstation", "Game Library", "Wireless Headphones",
    "Rear video Backup Camera", "Alarm system", "Alarm System With Paging Remote Alert", "Seats 1 Person", "Wide Track",
    "Long Track", "Power Windows, Mirrors, Steering, Locks", "Remote locks", "Tow Hitch", "Satellite Radio", "TV",
    "Captain Chairs", "DVD", "iPod support", "Cargo divider",
  ],
  COMPANY_TYPE: [
    "Affiliate", "Auto Glass", "Auto Repair", "Bank/Finance", "Body shop", "CHARITY", "Corporate", "Dealership",
    "Franchise", "Hotel", "ICBC", "Insurance", "Law Firm", "Leasing", "Mechanic", "Other", "Realtor", "Repair Service",
    "Travel Agency", "Travel Wholesaler",
  ],
  CUSTOMER_REGION: ["Burnaby", "Coquitlam", "Richmond", "Surrey", "Vancouver", "Calgary"],
  VEHICLE_CATEGORY: [],
  ENGINE_BRAND: [],
  ENGINE_TYPE: [],
  DISCOUNT_REASON: [],
  RENTAL_REASON: [],
};

// Settings > Rates > Miscellaneous Charges (first page of the live list).
const MISC_CHARGES: [string, string, number, "HOUR_24" | "FLAT"][] = [
  ["Additional Driver", "AD", 15, "HOUR_24"],
  ["Admin Fee GP", "ADF", 100, "FLAT"],
  ["After Hour Service Fee", "After Hour Service Fee", 50, "FLAT"],
  ["After Hours Airport Drop-off Fee", "After Hours Airport Drop-off Fee", 49.5, "FLAT"],
  ["Age Over 25", "Age Over 25", 0, "FLAT"],
  ["Airport Parking Fee", "APF", 39.5, "FLAT"],
  ["Amortization Value", "Amortization", 5000, "FLAT"],
  ["Appraisal Inspection Fee", "Appraisal Inspection Fee", 250, "FLAT"],
  ["BC to MT Use", "OOP BC to MT Use Only", 500, "FLAT"],
  ["BC to CA USE", "OOP BC to CA Only", 450, "FLAT"],
  ["BC to MB USE", "OOP BC to MB Only", 500, "FLAT"],
  ["BC to NV", "OOP BC to NV Only", 750, "FLAT"],
  ["BC to ON USE", "OOP BC to ON Only", 1000, "FLAT"],
  ["BC to SK USE", "OOP BC to SK Only", 600, "FLAT"],
  ["BC, AB to MT USE", "OOP BC, AB to MT Only", 500, "FLAT"],
  ["Booster Seat", "Booster", 15.95, "HOUR_24"],
  ["British Columbia Local Use", "BC/Local Use Only", 0, "FLAT"],
  ["Claim Admin Fee G", "CAF", 100, "FLAT"],
];

async function main() {
  // ── reference data ───────────────────────────────────────────────────────────
  const loc: Record<string, { id: string }> = {};
  for (const { key, ...data } of LOCATIONS) {
    const full = { ...SHARED, ...data };
    loc[key] = await prisma.location.upsert({ where: { id: `loc_${key}` }, update: full, create: { id: `loc_${key}`, ...full } });
    for (const [dayOfWeek, opensAt, closesAt] of HOURS[key] ?? [])
      await prisma.locationHours.upsert({
        where: { locationId_dayOfWeek: { locationId: `loc_${key}`, dayOfWeek } },
        update: { opensAt, closesAt, isClosed: opensAt === null },
        create: { locationId: `loc_${key}`, dayOfWeek, opensAt, closesAt, isClosed: opensAt === null },
      });
  }

  for (const [i, name] of VEHICLE_TYPES.entries()) {
    // Only the classes shown on mrrentacar.com are bookable online.
    const spec = { ...(TYPE_SPECS[name] ?? {}), displayOnline: name in TYPE_SPECS };
    await prisma.vehicleType.upsert({ where: { name }, update: spec, create: { name, sortOrder: i, ...spec } });
  }
  const vt = async (name: string) => (await prisma.vehicleType.findUniqueOrThrow({ where: { name } })).id;

  for (const name of MAKES) await prisma.vehicleMake.upsert({ where: { name }, update: {}, create: { name } });

  for (const [kind, names] of Object.entries(LOOKUPS) as [LookupKind, string[]][]) {
    for (const [i, name] of names.entries()) {
      await prisma.lookup.upsert({
        where: { kind_name: { kind, name } },
        update: {},
        create: { kind, name, sortOrder: i },
      });
    }
  }
  const lookup = async (kind: LookupKind, name: string) =>
    (await prisma.lookup.findUniqueOrThrow({ where: { kind_name: { kind, name } } })).id;

  for (const [name, code, rate, calculationBy] of MISC_CHARGES) {
    const existing = await prisma.miscCharge.findFirst({ where: { code } });
    if (!existing) await prisma.miscCharge.create({ data: { name, code, rate: D(rate), calculationBy } });
  }

  // Settings > Rates > Taxes, as listed on the live Bill Split form.
  const TAXES: [string, "PERCENT" | "AMOUNT", number, boolean][] = [
    ["Goods & Services Tax", "PERCENT", 5, false],
    ["GST(Gas)", "PERCENT", 5, false],
    ["Provincial Sales Tax", "PERCENT", 7, false],
    ["Passenger Vehicle Rental Tax", "AMOUNT", 1.5, true],
    ["Passenger Vehicle Rental Tax Credit", "AMOUNT", -1.5, true],
    ["Passenger Vehicle Rental Tax(ICBC)", "AMOUNT", 1.5, true],
    ["Tire Recovery", "AMOUNT", 0.99, false],
    ["WRITEOFF", "AMOUNT", -0.01, false],
    ["WRITEOFF-", "AMOUNT", -0.01, false],
    ["WRITEOFF+", "AMOUNT", 0.01, false],
  ];
  for (const [name, kind, value, perDay] of TAXES) {
    if (!(await prisma.tax.findFirst({ where: { name } })))
      await prisma.tax.create({ data: { name, kind, value: D(value), perDay } });
  }

  // Matches RentCentric Settings > Taxes per location (legacy/taxes.json; credits / write-offs are manual adjustments):
  // every BC location applies GST + PST + PVRT by default; Calgary applies GST.
  const taxId = async (name: string) => (await prisma.tax.findFirstOrThrow({ where: { name } })).id;
  const LOCATION_TAXES: Record<string, string[]> = {
    surrey: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    coquitlam: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    richmond: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    burnaby: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    vanAdmin: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    yvr: ["Goods & Services Tax", "Provincial Sales Tax", "Passenger Vehicle Rental Tax"],
    yyc: ["Goods & Services Tax"],
  };
  for (const [key, names] of Object.entries(LOCATION_TAXES))
    for (const n of names)
      await prisma.locationTax.upsert({
        where: { locationId_taxId: { locationId: loc[key]!.id, taxId: await taxId(n) } },
        update: {},
        create: { locationId: loc[key]!.id, taxId: await taxId(n) },
      });

  for (const name of ["ON LINE RESERVATION", "APAC AUTO GLASS LTD", "Craftsman Collision", "Dependable Auto Body"]) {
    await prisma.referral.upsert({ where: { name }, update: {}, create: { name } });
  }

  // ── dev staff user ───────────────────────────────────────────────────────────
  const staff = await prisma.user.upsert({
    where: { email: DEV_STAFF.email },
    update: {},
    create: {
      email: DEV_STAFF.email,
      name: DEV_STAFF.name,
      emailVerified: true,
      kind: "STAFF",
      role: "admin",
      defaultLocationId: loc.surrey!.id,
    },
  });
  if (!(await prisma.account.findFirst({ where: { userId: staff.id, providerId: "credential" } }))) {
    await prisma.account.create({
      data: {
        userId: staff.id,
        accountId: staff.id,
        providerId: "credential",
        password: await hashPassword(DEV_STAFF.password),
      },
    });
  }

  // ── FAKE test fleet + bookings (only if empty) ───────────────────────────────
  if ((await prisma.vehicle.count()) > 0) return;

  const model = async (make: string, name: string) => {
    const m = await prisma.vehicleMake.findUniqueOrThrow({ where: { name: make } });
    return prisma.vehicleModel.upsert({
      where: { makeId_name: { makeId: m.id, name } },
      update: {},
      create: { makeId: m.id, name },
    });
  };

  const car = await prisma.lookup.findUniqueOrThrow({ where: { kind_name: { kind: "VEHICLE_BODY", name: "Car" } } });
  const suv = await lookup("VEHICLE_BODY", "SUV");
  const gas = await lookup("FUEL_TYPE", "Gas");
  const electric = await lookup("FUEL_TYPE", "Electric");

  const fleet = [
    { assignedId: "T-101", make: "TOYOTA", model: "Corolla", year: 2024, colour: "White", type: "Compact", body: car.id, fuel: gas, plate: "TEST101", loc: "surrey", odo: 18450 },
    { assignedId: "T-102", make: "HONDA", model: "Civic", year: 2023, colour: "Grey", type: "Intermediate", body: car.id, fuel: gas, plate: "TEST102", loc: "surrey", odo: 30210 },
    { assignedId: "T-103", make: "TOYOTA", model: "RAV4", year: 2024, colour: "Blue", type: "Standard SUV", body: suv, fuel: gas, plate: "TEST103", loc: "surrey", odo: 12880 },
    { assignedId: "T-104", make: "MERCEDES-BENZ", model: "GLC 300", year: 2023, colour: "Black", type: "MB GLC Class", body: suv, fuel: gas, plate: "TEST104", loc: "coquitlam", odo: 22015 },
    { assignedId: "T-105", make: "KIA", model: "Carnival", year: 2024, colour: "Silver", type: "VAN 8P Minivan", body: await lookup("VEHICLE_BODY", "Minivan"), fuel: gas, plate: "TEST105", loc: "yyc", odo: 9050 },
    { assignedId: "E-201", make: "BMW", model: "iX xDrive50", year: 2024, colour: "White", type: "iX xDrive", body: suv, fuel: electric, plate: "TEST201", loc: "surrey", odo: 7420 },
  ];
  const vehicles: Record<string, { id: string; vehicleTypeId: string }> = {};
  for (const v of fleet) {
    const m = await model(v.make, v.model);
    vehicles[v.assignedId] = await prisma.vehicle.create({
      data: {
        assignedId: v.assignedId,
        makeId: m.makeId,
        modelId: m.id,
        year: v.year,
        colour: v.colour,
        doors: 4,
        transmission: "AUTOMATIC",
        vehicleTypeId: await vt(v.type),
        rentalLocationId: loc[v.loc]!.id,
        owningLocationId: loc[v.loc]!.id,
        bodyId: v.body,
        fuelTypeId: v.fuel,
        tankSize: v.fuel === electric ? 0 : 50,
        originalOdometer: 0,
        currentOdometer: v.odo,
        maintenanceEveryKm: 8000,
        insuranceAmount: D(1800),
        licenseNumber: v.plate,
        licenseProvince: v.loc === "yyc" ? "Alberta" : "British Columbia",
      },
    });
  }

  const rate = await prisma.rate.create({
    data: {
      code: "DEV Standard 1 to 6 Days",
      locationId: loc.surrey!.id,
      displayOnline: true,
      calculationBy: "HOUR_24",
      rateType: "Standard",
      effectiveDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      extraKmCharge: D(0.25),
      graceMinutes: 59,
      fuelChargePerUnit: D(2),
      minChargeDays: 1,
      values: {
        create: [
          { vehicleTypeId: await vt("Compact"), daily: D(49.95), hourly: D(12), weekly: D(299), kmAllowed: 200 },
          { vehicleTypeId: await vt("Intermediate"), daily: D(59.95), hourly: D(14), weekly: D(349), kmAllowed: 200 },
          { vehicleTypeId: await vt("Standard SUV"), daily: D(79.95), hourly: D(18), weekly: D(469), kmAllowed: 200 },
        ],
      },
    },
  });

  const company = await prisma.company.create({
    data: { name: "Test Fleet Corp (FAKE)", typeId: await lookup("COMPANY_TYPE", "Corporate"), phone: "604-555-0100" },
  });

  const alex = await prisma.customer.create({
    data: {
      firstName: "Alex",
      lastName: "Testrenter",
      birthDate: new Date("1990-04-12"),
      address1: "100 Example St",
      city: "Surrey",
      province: "British Columbia",
      postal: "V3T 0A1",
      country: "Canada",
      phone: "604-555-0111",
      email: "alex.testrenter@example.com",
      licenseNumber: "TEST-DL-0001",
      licenseExpiry: new Date("2029-04-12"),
      licenseProvince: "British Columbia",
      insuranceCompany: "Example Insurance",
      insurancePolicyNumber: "POL-TEST-1",
      defaultLocationId: loc.surrey!.id,
      companyId: company.id,
    },
  });
  const sam = await prisma.customer.create({
    data: {
      firstName: "Sam",
      lastName: "Seconddriver",
      birthDate: new Date("2003-09-02"),
      phone: "604-555-0122",
      licenseNumber: "TEST-DL-0002",
      licenseProvince: "British Columbia",
      primaryCustomerId: alex.id,
    },
  });

  const surreyId = loc.surrey!.id;
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

  // Open rental with a reservation behind it, extra driver, misc charges, two payment types, memos.
  const res = await prisma.reservation.create({
    data: {
      status: "CHECKED_OUT",
      customerId: alex.id,
      firstName: alex.firstName,
      lastName: alex.lastName,
      email: alex.email,
      phone: alex.phone,
      locationId: surreyId,
      pickupLocationId: surreyId,
      returnLocationId: surreyId,
      pickupAt: days(-2),
      returnAt: days(3),
      vehicleTypeId: vehicles["T-103"]!.vehicleTypeId,
      vehicleId: vehicles["T-103"]!.id,
      rateId: rate.id,
      companyId: company.id,
      createdById: staff.id,
    },
  });

  const ad = await prisma.miscCharge.findFirstOrThrow({ where: { code: "AD" } });
  const gst = await prisma.tax.findFirstOrThrow({ where: { name: "Goods & Services Tax" } });
  const pst = await prisma.tax.findFirstOrThrow({ where: { name: "Provincial Sales Tax" } });
  const pvrt = await prisma.tax.findFirstOrThrow({ where: { name: "Passenger Vehicle Rental Tax" } });

  const rental = await prisma.rental.create({
    data: {
      reservationId: res.id,
      customerId: alex.id,
      companyId: company.id,
      checkOutLocationId: surreyId,
      checkInLocationId: surreyId,
      checkOutAt: days(-2),
      expectedReturnAt: days(3),
      vehicleTypeId: vehicles["T-103"]!.vehicleTypeId,
      vehicleId: vehicles["T-103"]!.id,
      odometerOut: 12880,
      fuelOut: 16,
      rateId: rate.id,
      deposit: D(500),
      poNumber: "PO-TEST-77",
      openedById: staff.id,
      drivers: { create: [{ customerId: sam.id }] },
      chargeLines: {
        create: [
          { kind: "TIME", name: "Daily Rate", units: D(5), rate: D(79.95), total: D(399.75), sortOrder: 0 },
          { kind: "MILEAGE", name: "Km Allowed", units: D(1000), rate: D(0), total: D(0), sortOrder: 1 },
          { kind: "MISC", name: "Additional Driver", units: D(5), rate: D(15), total: D(75), miscChargeId: ad.id, sortOrder: 2 },
          { kind: "MISC", name: "Under Age Driver Fee", units: D(5), rate: D(25), total: D(125), sortOrder: 3 },
          { kind: "TAX", name: "Passenger Vehicle Rental Tax", units: D(5), rate: D(1.5), total: D(7.5), taxId: pvrt.id, sortOrder: 9 },
          { kind: "ADMIN", name: "Admin Charge", units: D(1), rate: D(15), total: D(15), sortOrder: 8 },
          { kind: "TAX", name: "Goods & Services Tax", units: D(1), rate: D(5), total: D(30.36), taxId: gst.id, sortOrder: 10 },
          { kind: "TAX", name: "Provincial Sales Tax", units: D(1), rate: D(7), total: D(42.51), taxId: pst.id, sortOrder: 11 },
        ],
      },
      payments: {
        create: [
          { customerId: alex.id, method: "EMT", transactionType: "PAYMENT", amount: D(300), takenById: staff.id, takenAt: days(-2) },
          { customerId: alex.id, method: "VISA", transactionType: "AUTHORIZATION", amount: D(500), authorizationCode: "TEST01", cardLast4: "4242", takenById: staff.id, takenAt: days(-2) },
        ],
      },
      memos: {
        create: [
          { body: "Customer asked about extending by 2 days — call back Friday.", authorId: staff.id, createdAt: days(-1) },
          { body: "Second driver is under 25; fee applied.", authorId: staff.id, createdAt: days(-2), showAsPopup: true },
        ],
      },
    },
  });
  await prisma.vehicleBlock.create({
    data: { vehicleId: vehicles["T-103"]!.id, startsAt: days(-2), endsAt: days(3), rentalId: rental.id },
  });
  await prisma.rentalVehicleSegment.create({
    data: { rentalId: rental.id, vehicleId: vehicles["T-103"]!.id, startsAt: days(-2), odometerOut: 12880, fuelOut: 16 },
  });
  await prisma.trafficTicket.create({
    data: { rentalId: rental.id, ticketDate: days(-1), offense: "Speeding — TEST TICKET", amount: D(138), city: "Surrey", province: "British Columbia" },
  });
  await prisma.chargeLine.create({
    data: { rentalId: rental.id, kind: "TRAFFIC_TICKETS", name: "Traffic Tickets", units: D(1), rate: D(138), total: D(138), sortOrder: 7 },
  });
  await prisma.memo.create({ data: { kind: "NOTE", rentalId: rental.id, body: "Keys handed over at counter 2.", authorId: staff.id } });
  await prisma.auditLog.createMany({
    data: [
      { entityType: "Rental", entityId: rental.id, field: "RANumber", oldValue: "Start Rental", newValue: String(rental.raNumber), userId: staff.id, at: days(-2) },
      { entityType: "Rental", entityId: rental.id, field: "CheckinDate", oldValue: days(2).toISOString(), newValue: days(3).toISOString(), userId: staff.id, at: days(-1) },
    ],
  });
  await prisma.vehicle.update({ where: { id: vehicles["T-103"]!.id }, data: { status: "ON_RENT" } });

  // Upcoming reservations (one assigned, one unassigned) and a quote.
  const r2 = await prisma.reservation.create({
    data: {
      status: "CONFIRMED",
      customerId: sam.id,
      firstName: sam.firstName,
      lastName: sam.lastName,
      phone: sam.phone,
      locationId: surreyId,
      pickupLocationId: surreyId,
      returnLocationId: surreyId,
      pickupAt: days(1),
      returnAt: days(4),
      vehicleTypeId: vehicles["T-101"]!.vehicleTypeId,
      vehicleId: vehicles["T-101"]!.id,
      rateId: rate.id,
      createdById: staff.id,
    },
  });
  await prisma.vehicleBlock.create({
    data: { vehicleId: vehicles["T-101"]!.id, startsAt: days(1), endsAt: days(4), reservationId: r2.id },
  });
  await prisma.reservation.create({
    data: {
      status: "TENTATIVE",
      firstName: "Jordan",
      lastName: "Walkin",
      phone: "604-555-0133",
      locationId: surreyId,
      pickupLocationId: surreyId,
      returnLocationId: surreyId,
      pickupAt: days(2),
      returnAt: days(6),
      vehicleTypeId: await vt("Intermediate"),
      rateId: rate.id,
      createdById: staff.id,
    },
  });
  await prisma.quote.create({
    data: {
      pickupAt: days(7),
      returnAt: days(10),
      pickupLocationId: surreyId,
      returnLocationId: surreyId,
      vehicleTypeId: await vt("Compact"),
      rateId: rate.id,
      contactName: "Taylor Quoteonly",
      contactPhone: "604-555-0144",
      createdById: staff.id,
      chargeLines: {
        create: [{ kind: "TIME", name: "Daily Rate", units: D(3), rate: D(49.95), total: D(149.85) }],
      },
    },
  });
}

main()
  .then(() => console.log("Seed complete."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
