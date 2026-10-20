import { applyRateOverride, readRateOverride } from "./rate-override";
import { methodLabel } from "./payment-methods";
import type { Prisma } from "@mrac/db";
import { RESERVATION_TEMPLATE_CODES, TEMPLATE_CODES } from "./template-codes";
import { rentalTotals } from "./totals";
import { isSignatureField, signatureFields } from "./signature-fields";

type Db = Prisma.TransactionClient;
type Fields = Record<string, string>;

/** RentCentric money: "$2,248.75", negatives "-$20.00". */
const money = (v: unknown) => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const num = (v: unknown) => (v == null ? "" : String(Number(v)));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** RentCentric's template date formats (seen on its printed contracts). */
function rc(d: Date | null | undefined, tz: string, style: "HH:mm" | "ddd, MMM d, yyyy" | "MM/dd/yyyy" | "M/d/yyyy h:mm:ss tt") {
  if (!d) return "";
  const p = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o }).format(d);
  if (style === "HH:mm") return p({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (style === "ddd, MMM d, yyyy") return p({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (style === "MM/dd/yyyy") return p({ month: "2-digit", day: "2-digit", year: "numeric" });
  return p({ month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).replace(",", "");
}

function fmt(d: Date | null | undefined, tz: string, part: "date" | "time" | "both") {
  if (!d) return "";
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric", day: "numeric", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return part === "date" ? date : part === "time" ? time : `${date} ${time}`;
}

/** RentCentric numbers placeholders differently for reservation templates. */
export const codesFor = (kind: string) => (kind === "RESERVATION" ? RESERVATION_TEMPLATE_CODES : TEMPLATE_CODES);

/** Fill RentCentric ##code## placeholders (numbers, or a field name) from `fields`; unknown codes print empty. */
export function renderTemplate(html: string, fields: Fields, kind = "AGREEMENT", raw: Set<string> = HTML_FIELDS) {
  const codes = codesFor(kind);
  return html.replace(/##([0-9A-Za-z\\]+)##/g, (_, code: string) => {
    const name = codes[code] ?? code;
    const v = fields[name] ?? "";
    return raw.has(name) || isSignatureField(name) ? v : esc(v);
  });
}

/** Fields whose values are HTML (not escaped when rendered). */
export const HTML_FIELDS = new Set(["ChargesSummaryTable", "Invoice\\chargesSummary", "InvoiceOptionRows", "InvoiceTaxRows", "PaymentRows"]);

type Line = {
  taxId?: string | null;
  name: string;
  kind: string;
  units: unknown;
  rate: unknown;
  total: unknown;
  tax?: { kind: string } | null;
  insurance?: { code: string | null; deductible: unknown } | null;
  miscCharge?: { code: string | null } | null;
};
type Pay = { takenAt?: Date; method: string; methodName?: string | null; amount: unknown; transactionType: string; cardLast4: string | null; authorizationCode: string | null; creditCard?: { brand: string; expMonth: number; expYear: number } | null };
type Person = { firstName: string; lastName: string; address1?: string | null; address2?: string | null; city?: string | null; province?: string | null; postal?: string | null; country?: string | null; phone?: string | null; birthDate?: Date | null; licenseNumber?: string | null; licenseProvince?: string | null; licenseExpiry?: Date | null };
type Loc = { refuelPrice?: unknown; legalName?: string | null; gstNumber?: string | null; name: string; address1: string | null; address2: string | null; city: string | null; province: string | null; postal: string | null; phone: string | null; fax: string | null; timeZone: string; hours?: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[] };
type Company = { name: string; code: string | null; address1: string | null; address2: string | null; city: string | null; province: string | null; postal: string | null; country: string | null; phone: string | null; fax: string | null; contactName: string | null } | null;

/** One rental / reservation / quote in the shape the template fields are built from. */
type Doc = {
  raNumber?: number | null;
  status: string;
  location: Loc;
  returnLocation: { name: string; address1?: string | null };
  out: Date;
  dueIn: Date;
  in?: Date | null;
  customer: Person;
  company: Company;
  vehicle?: { assignedId: string; year: number | null; make: string; model: string; licenseNumber: string | null; vin: string | null; colour: string | null; doors: number | null } | null;
  vehicleType: { name: string; seats: number | null; doors: number | null; luggage: number | null; imageKey: string | null };
  lines: Line[];
  payments: Pay[];
  billSplits: unknown[];
  discountType?: string | null;
  discountValue?: unknown;
  rateCode?: string | null;
  referral?: string | null;
  openedBy?: string | null;
  closedBy?: string | null;
  memo?: string | null;
  claimNumber?: string | null;
  roNumber?: string | null;
  poNumber?: string | null;
  flightNumber?: string | null;
  odometerOut?: number | null;
  odometerIn?: number | null;
  fuelOut?: number | null;
  fuelIn?: number | null;
  drivers?: Person[];
  /** the location's tax codes ("GST 5%") by tax id */
  taxCodes?: Record<string, string>;
  /** the rate's per-unit prices for the vehicle type (printed even when that unit isn't used) */
  rateTable?: { hourly: unknown; daily: unknown; extraDaily: unknown; weekly: unknown; monthly: unknown } | null;
};

/** The legacy charge table (ChargesSummaryTable / Invoice\chargesSummary): Charge, Unit, Rate, Total, then totals and payments. */
function chargesTable(lines: Line[], totals: ReturnType<typeof rentalTotals>, payments: Pay[]) {
  const row = (a: string, u = "", r = "", t = "") => `<tr><td>${esc(a)}</td><td style="text-align:right">${u}</td><td style="text-align:right">${r}</td><td style="text-align:right">${t}</td></tr>`;
  const body = lines
    .filter((l) => !(l.kind === "MILEAGE" && !Number(l.total)))
    .map((l) => row(l.name, Number(l.units) ? num(l.units) : "", l.kind === "TAX" && l.tax?.kind !== "AMOUNT" ? `${Number(l.rate)}%` : Number(l.rate) ? money(l.rate) : "", money(l.total)))
    .join("");
  const pays = payments.map((p) => row(`${methodLabel(p)}${p.cardLast4 ? ` XXXX${p.cardLast4}` : ""}${p.transactionType === "AUTHORIZATION" ? " (A)" : ""}`, "", "", money(p.transactionType === "REFUND" ? -Number(p.amount) : p.amount))).join("");
  return `<table class="charges-summary" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Charge</th><th style="text-align:right">Unit</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead><tbody>${body}${row("Total", "", "", money(totals.total))}${pays}${row("Total Payments", "", "", money(totals.totalPayments))}${row("Balance", "", "", money(totals.balance))}</tbody></table>`;
}

/** Every template field we can fill for a document (names as in RentCentric's field tree). */
function docFields(d: Doc): Fields {
  const tz = d.location.timeZone;
  const totals = rentalTotals(d.lines as never, d.payments as never, d.billSplits as never);
  const f: Fields = {};
  const set = (k: string, v: unknown) => {
    f[k] = v == null ? "" : String(v);
  };
  const c = d.customer;
  const loc = d.location;
  const co = d.company;

  // document
  set("RANumber", d.raNumber);
  set("ClaimNumber", d.claimNumber);
  set("RepairOrderNumber", d.roNumber);
  set("AgreementPONumber", d.poNumber);
  set("RentalStatus", d.status);
  // printed contracts show "Rental In" once closed, "Rental Out" while open
  set("LabelRentalStatus", d.status === "CLOSED" ? "Rental In" : d.status === "OPEN" ? "Rental Out" : d.status);
  set("Referral", d.referral);
  set("OpenedBy", d.openedBy);
  set("AdminName", d.openedBy);
  set("ClosedBy", d.closedBy);
  set("Memo", d.memo);
  set("FlightNumber", d.flightNumber);
  set("DropOffLocation", d.returnLocation.address1 || d.returnLocation.name);
  set("PickupLocationName", d.location.name);
  set("ReturnLocationName", d.returnLocation.name);
  set("CurrentDate", fmt(new Date(), tz, "date"));
  // dates
  const back = d.in ?? d.dueIn;
  set("DateOut", fmt(d.out, tz, "both"));
  set("DateIn", fmt(d.in ?? d.dueIn, tz, "both"));
  set("DateDueIn", rc(d.dueIn, tz, "M/d/yyyy h:mm:ss tt"));
  set("CheckOutTime", rc(d.out, tz, "HH:mm"));
  set("DateOutWithoutTime", rc(d.out, tz, "ddd, MMM d, yyyy"));
  set("CheckInTime", rc(back, tz, "HH:mm"));
  set("DateInWithoutTime", rc(back, tz, "MM/dd/yyyy"));
  set("RentalDays", Math.max(1, Math.ceil((+back - +d.out) / 86_400_000)));
  // odometer / fuel
  set("OdometerOut", d.odometerOut);
  set("OdometerIn", d.odometerIn);
  set("TotalKMDriven", d.odometerIn != null && d.odometerOut != null ? d.odometerIn - d.odometerOut : "");
  set("FuelLevelOut", d.fuelOut != null ? `${d.fuelOut}/16` : "");
  set("FuelLevelIn", d.fuelIn != null ? `${d.fuelIn}/16` : "");
  set("UsedFuel", d.fuelIn != null && d.fuelOut != null ? `${Math.max(0, d.fuelOut - d.fuelIn)}/16` : "");
  // "ReFuel: $ ##310##/L" — the location's Convenience ReFuel price per litre
  set("FuelRate", d.location.refuelPrice != null ? Number(d.location.refuelPrice).toFixed(2) : "");
  // customer
  set("CustomerFirstName", c.firstName);
  set("CustomerLastName", c.lastName);
  set("CustomerAddress", [c.address1, c.address2].filter(Boolean).join(" "));
  set("CustomerCity", c.city);
  set("CustomerStateCode", c.province);
  set("customerStateName", c.province);
  set("CustomerZIP", c.postal);
  set("CustomerCountry", c.country);
  set("CustomerPhone", c.phone);
  set("CustomerBirthDate", c.birthDate ? fmt(c.birthDate, "UTC", "date") : "");
  set("DrviserLicenseNumber", c.licenseNumber);
  set("DriverLicenseStateCode", c.licenseProvince);
  set("DriverLicenseStateName", c.licenseProvince);
  (d.drivers ?? []).slice(0, 5).forEach((p, i) => {
    const k = `AddDriver${i + 1}`;
    set(`${k}Name`, `${p.firstName} ${p.lastName}`);
    set(`${k}FirstName`, p.firstName);
    set(`${k}LastName`, p.lastName);
    set(`${k}DOB`, p.birthDate ? fmt(p.birthDate, "UTC", "date") : "");
    set(`${k}LicenseNumber`, p.licenseNumber);
    set(`${k}LicenseStateCode`, p.licenseProvince);
    set(`${k}LicenseStateName`, p.licenseProvince);
    set(`${k}LicenseExp`, p.licenseExpiry ? fmt(p.licenseExpiry, "UTC", "date") : "");
    set(`${k}Address`, p.address1);
    set(`${k}City`, p.city);
    set(`${k}Phone`, p.phone);
  });
  // location
  set("LocationName", loc.name);
  set("LocationAddress", [loc.address1, loc.address2].filter(Boolean).join(" "));
  set("LocationCity", loc.city);
  set("LocationState", loc.province);
  set("LocationZIP", loc.postal);
  set("LocationPhone", loc.phone);
  set("LocationFax", loc.fax);
  set("LocationWebSite", "http://www.mrrentacar.com");
  set("LegalLocationName", loc.legalName ?? "Mr Rent A Car");
  set("GSTNumber", loc.gstNumber);
  set("LocationFullAddress", [loc.address1, loc.city, loc.province, loc.postal].filter(Boolean).join(", "));
  set(
    "LocationHours",
    (loc.hours ?? [])
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((h) => `${DAYS[h.dayOfWeek]}: ${h.isClosed ? "Closed" : `${h.opensAt ?? ""} - ${h.closesAt ?? ""}`}`)
      .join(", "),
  );
  // vehicle
  const v = d.vehicle;
  set("AssignedID", v?.assignedId);
  set("Year", v?.year);
  set("Make", v?.make);
  set("Model", v?.model);
  set("VehicleLicenseNumber", v?.licenseNumber);
  set("VINNumber", v?.vin);
  set("Color", v?.colour);
  set("NumberOfDoors", v?.doors ?? d.vehicleType.doors);
  set("NumberOfPassengers", d.vehicleType.seats);
  set("NumberOfLuggages", d.vehicleType.luggage);
  set("VehicleType", d.vehicleType.name);
  // used as <img src="##VehicleTypeImage##"> in the templates
  set("VehicleTypeImage", d.vehicleType.imageKey ? new URL(d.vehicleType.imageKey, process.env.BETTER_AUTH_URL ?? "http://localhost:3001").href : "");
  // company / bill to
  set("CompanyName", co?.name);
  set("CompanyCode", co?.code);
  set("CompanyAddress1", co?.address1);
  set("CompanyAddress2", co?.address2);
  set("CompanyCity", co?.city);
  set("CompanyStateCode", co?.province);
  set("CompanyZip", co?.postal);
  set("CompanyCountry", co?.country);
  set("CompanyPhone", co?.phone);
  set("CompanyFax", co?.fax);
  set("CompanyContactName", co?.contactName);
  set("BillToCompany", co?.name ?? "None");

  // charges by unit (legacy names: Hourly / Daily / Extra Daily / Weekly / Monthly)
  const time = (name: string) => d.lines.find((l) => l.kind === "TIME" && l.name.toLowerCase() === name.toLowerCase());
  for (const [label, unitsKey, rateKey, totalKey] of [
    ["Hourly", "TotalHours", "HourlyRate", "HourlyTotal"],
    ["Daily", "TotalDayes", "DailyRate", "DailyTotal"],
    ["Extra Daily", "ExtraDayes", "ExtraDailyRate", "ExtraDailyTotal"],
    ["Weekly", "TotalWeeks", "Weeklyrate", "WeeklyTotal"],
    ["Monthly", "TotalMonthes", "Monthlyrate", "MonthlyTotal"],
  ] as const) {
    const l = time(label);
    const tableRate = d.rateTable?.[({ Hourly: "hourly", Daily: "daily", "Extra Daily": "extraDaily", Weekly: "weekly", Monthly: "monthly" } as const)[label]];
    set(unitsKey, l ? num(l.units) : "0");
    set(rateKey, l ? money(l.rate) : tableRate != null ? money(tableRate) : "");
    set(totalKey, l ? money(l.total) : "$0.00");
  }
  const mileage = d.lines.filter((l) => l.kind === "MILEAGE");
  const allowed = mileage.find((l) => !Number(l.total));
  set("TotalMilesAllowed", allowed ? num(allowed.units) : "");
  const extraKm = mileage.find((l) => Number(l.total));
  // "Extra KMs": km driven beyond the allowance, printed even when the extra-km rate is $0
  const driven = d.odometerIn != null && d.odometerOut != null ? d.odometerIn - d.odometerOut : null;
  const over = extraKm ? Number(extraKm.units) : driven != null && allowed ? Math.max(0, driven - Number(allowed.units)) : 0;
  set("KMEExceed", over);
  set("KMMilesCharged", money(extraKm ? extraKm.rate : 0));
  set("KMExceedCharge", money(extraKm ? extraKm.total : 0));
  set("TotalTimeAndMileAges", money(totals.timeAndKm));
  set("TotalTimeAndMileAgesInLocalCurrency", money(totals.timeAndKm));
  const sumOf = (...kinds: string[]) => d.lines.filter((l) => kinds.includes(l.kind)).reduce((a, l) => a + Number(l.total), 0);
  const optMoney = (n: number) => (n ? money(n) : "");
  set("DiscountAmount", optMoney(sumOf("DISCOUNT")));
  set("DiscountPercentage", d.discountType === "PERCENT" && d.discountValue ? `${Number(d.discountValue)}%` : "");
  set("FuelCharge", optMoney(sumOf("FUEL", "PREPAID_FUEL")));
  set("Damages", optMoney(sumOf("DAMAGES")));
  set("TrafficTicket", money(sumOf("TRAFFIC_TICKETS"))); // "Traffic Tickets $0.00" on the contract
  set("OneWayFee", optMoney(sumOf("ONE_WAY")));
  set("TotalMiscCharges", optMoney(sumOf("MISC")));
  set("TotalTaxes", optMoney(sumOf("TAX")));
  set("NetRate", d.rateCode);
  // numbered protections / misc charges / taxes / other charges
  const ins = d.lines.filter((l) => l.kind === "PROTECTION");
  ins.slice(0, 8).forEach((l, i) => {
    set(`Insurance${i + 1}Code`, l.insurance?.code ?? l.name);
    set(`Insurance${i + 1}Name`, l.name);
    set(`Insurance${i + 1}Value`, money(l.total));
    set(`Insurance${i + 1}ValueInLocalCurrency`, money(l.total));
  });
  const deductible = ins.find((l) => l.insurance?.deductible != null)?.insurance?.deductible;
  set("LDWDeductible", deductible != null ? money(deductible) : "");
  set("AgreementInsurancesDetuctible", deductible != null ? money(deductible) : "");
  set("VehicleLDW", ins[0]?.name);
  d.lines.filter((l) => l.kind === "MISC").slice(0, 12).forEach((l, i) => {
    set(`MiscCharge${i + 1}Code`, l.miscCharge?.code ?? l.name);
    set(`MiscCharge${i + 1}Name`, l.name);
    set(`MiscCharge${i + 1}Amount`, money(l.total));
  });
  d.lines.filter((l) => l.kind === "TAX").slice(0, 8).forEach((l, i) => {
    set(`Tax${i + 1}Code`, (l.taxId && d.taxCodes?.[l.taxId]) || (l.tax?.kind === "AMOUNT" ? money(l.rate) : `${Number(l.rate)}%`));
    set(`Tax${i + 1}Name`, l.name);
    set(`Tax${i + 1}Amount`, money(l.total));
  });
  d.lines.filter((l) => l.kind === "OTHER").slice(0, 4).forEach((l, i) => {
    const n = i === 0 ? "" : String(i + 1);
    set(`OtherCharges${n}`, money(l.total));
    set(`OtherChargesDetails${n}`, l.name);
  });
  // totals and payments
  set("TotalEstimatedCharges", money(totals.total));
  set("AllCharges", money(totals.total));
  set("Renterpayments", money(totals.totalPayments));
  set("Balance", money(totals.balance));
  set("BillTotal", money(totals.total));
  set("CompanyBillBalance", money(totals.splitBillBalance));
  const auth = d.payments.find((p) => p.transactionType === "AUTHORIZATION") ?? d.payments[0];
  set("PaymentType", auth ? methodLabel(auth) : "");
  set("CCType", auth?.creditCard?.brand ?? (auth ? methodLabel(auth) : ""));
  set("CreditCardNumberDisplay", auth?.cardLast4 ? `XXXX${auth.cardLast4}` : "");
  set("AuthCode", auth?.authorizationCode);
  set("Auth", auth ? money(auth.amount) : "");
  set("CCExpiry", auth?.creditCard ? `${String(auth.creditCard.expMonth).padStart(2, "0")}/${auth.creditCard.expYear}` : "");
  set("LicenseExpiry", c.licenseExpiry ? fmt(c.licenseExpiry, "UTC", "date") : "");
  set("CustomerLicenseExpiry", f.LicenseExpiry);
  // Customer Invoice "Statement of Charges": one row per protection / misc charge (by code) and per tax (by code)
  const row = (a: string, b: string) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
  f.InvoiceOptionRows = d.lines
    .filter((l) => l.kind === "PROTECTION" || l.kind === "MISC")
    .map((l) => row(l.insurance?.code ?? l.miscCharge?.code ?? l.name, money(l.total)))
    .join("");
  f.InvoiceTaxRows = d.lines
    .filter((l) => l.kind === "TAX")
    .map((l) => row((l.taxId && d.taxCodes?.[l.taxId]) || l.name, money(l.total)))
    .join("");
  f.PaymentRows = d.payments
    .map((p) => row(`${p.takenAt ? fmt(p.takenAt, tz, "both") : ""} ${methodLabel(p)}${p.cardLast4 ? ` XXXX${p.cardLast4}` : ""}`.trim(), money(p.transactionType === "REFUND" ? -Number(p.amount) : p.amount)))
    .join("");
  set("RateCharge", money(d.lines.filter((l) => l.kind === "TIME").reduce((a, l) => a + Number(l.total), 0)));
  // Customer Invoice style: short dates, $0.00 instead of blank, discount in brackets
  set("DateRented", fmt(d.out, tz, "date"));
  set("DateReturned", fmt(d.in ?? null, tz, "date"));
  set("TrafficAmount", money(sumOf("TRAFFIC_TICKETS")));
  set("OneWayAmount", money(sumOf("ONE_WAY")));
  set("FuelAmount", money(sumOf("FUEL", "PREPAID_FUEL")));
  set("DiscountInBrackets", sumOf("DISCOUNT") ? `(${money(Math.abs(sumOf("DISCOUNT")))})` : "$0.00");
  f.ChargesSummaryTable = chargesTable(d.lines, totals, d.payments);
  f["Invoice\\chargesSummary"] = f.ChargesSummaryTable;
  return f;
}

const lineInclude = { tax: { select: { kind: true } }, insurance: { select: { code: true, deductible: true } }, miscCharge: { select: { code: true } } } satisfies Prisma.ChargeLineInclude;
const lineOrder = [{ sortOrder: "asc" }, { id: "asc" }] satisfies Prisma.ChargeLineOrderByWithRelationInput[];
const locInclude = { hours: true } satisfies Prisma.LocationInclude;
/** A location's tax codes by tax id. */
async function taxCodesAt(db: Db, locationId: string) {
  const rows = await db.locationTax.findMany({ where: { locationId, code: { not: null } }, select: { taxId: true, code: true } });
  return Object.fromEntries(rows.map((x) => [x.taxId, x.code!]));
}

const vehicleOf = (v: { assignedId: string; year: number | null; make: { name: string }; model: { name: string }; licenseNumber: string | null; vin: string | null; colour: string | null; doors: number | null } | null) =>
  v ? { assignedId: v.assignedId, year: v.year, make: v.make.name, model: v.model.name, licenseNumber: v.licenseNumber, vin: v.vin, colour: v.colour, doors: v.doors } : null;

export async function rentalTemplateFields(db: Db, rentalId: string) {
  const r = await db.rental.findUniqueOrThrow({
    where: { id: rentalId },
    include: {
      customer: true,
      company: true,
      vehicle: { include: { make: true, model: true } },
      vehicleType: true,
      checkOutLocation: { include: locInclude },
      checkInLocation: true,
      referral: true,
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      rate: { include: { values: true } },
      chargeLines: { orderBy: lineOrder, include: lineInclude },
      payments: { orderBy: { takenAt: "asc" }, include: { creditCard: true } },
      drivers: { include: { customer: true } },
      memos: { where: { kind: "MEMO" }, orderBy: { createdAt: "desc" }, take: 1 },
      billSplits: true,
    },
  });
  return { ...(await signatureFields(db, r.chargeLines, r.checkOutAt)), ...docFields({
    taxCodes: await taxCodesAt(db, r.checkOutLocationId),
    rateTable: applyRateOverride(r.rate?.values.find((x) => x.vehicleTypeId === r.vehicleTypeId && !x.seasonId) ?? r.rate?.values.find((x) => x.vehicleTypeId === r.vehicleTypeId), readRateOverride(r.rateOverride)) ?? null,
    raNumber: r.raNumber,
    status: r.status === "OPEN" ? "OPEN" : r.status === "CLOSED" ? "CLOSED" : "VOID",
    location: r.checkOutLocation,
    returnLocation: r.checkInLocation,
    out: r.checkOutAt,
    dueIn: r.expectedReturnAt,
    in: r.checkedInAt,
    customer: r.customer,
    company: r.company,
    vehicle: vehicleOf(r.vehicle),
    vehicleType: r.vehicleType,
    lines: r.chargeLines,
    payments: r.payments,
    billSplits: r.billSplits,
    discountType: r.discountType,
    discountValue: r.discountValue,
    rateCode: r.rate?.code,
    referral: r.referral?.name,
    openedBy: r.openedBy?.name,
    closedBy: r.closedBy?.name,
    memo: r.memos[0]?.body,
    claimNumber: r.claimNumber,
    roNumber: r.roNumber,
    poNumber: r.poNumber,
    flightNumber: r.flightNumber,
    odometerOut: r.odometerOut,
    odometerIn: r.odometerIn,
    fuelOut: r.fuelOut,
    fuelIn: r.fuelIn,
    drivers: r.drivers.map((x) => x.customer),
  }) };
}

/** Reservation Confirmation / HTMLReservation: the same fields, with the reservation # as RANumber (as RentCentric does). */
export async function reservationTemplateFields(db: Db, reservationId: string) {
  const r = await db.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      customer: true,
      company: true,
      vehicle: { include: { make: true, model: true } },
      vehicleType: true,
      pickupLocation: { include: locInclude },
      returnLocation: true,
      referral: true,
      createdBy: { select: { name: true } },
      rate: true,
      chargeLines: { orderBy: lineOrder, include: lineInclude },
      payments: { orderBy: { takenAt: "asc" }, include: { creditCard: true } },
      drivers: { include: { customer: true } },
      memos: { where: { kind: "MEMO" }, orderBy: { createdAt: "desc" }, take: 1 },
      billSplits: true,
    },
  });
  const f = Object.assign(await signatureFields(db, r.chargeLines, r.pickupAt), docFields({
    taxCodes: await taxCodesAt(db, r.pickupLocationId),
    raNumber: r.number,
    status: r.status,
    location: r.pickupLocation,
    returnLocation: r.returnLocation,
    out: r.pickupAt,
    dueIn: r.returnAt,
    customer: r.customer ?? { firstName: r.firstName, lastName: r.lastName, phone: r.phone },
    company: r.company,
    vehicle: vehicleOf(r.vehicle),
    vehicleType: r.vehicleType,
    lines: r.chargeLines,
    payments: r.payments,
    billSplits: r.billSplits,
    discountType: r.discountType,
    discountValue: r.discountValue,
    rateCode: r.rate?.code,
    referral: r.referral?.name,
    openedBy: r.createdBy?.name,
    memo: r.memos[0]?.body,
    roNumber: r.roNumber,
    poNumber: r.poNumber,
    flightNumber: r.flightNumber,
    drivers: r.drivers.map((x) => x.customer),
  }));
  // the reservation field tree's own names
  const tz = r.pickupLocation.timeZone;
  const put = (k: string, v: unknown) => {
    f[k] = v == null ? "" : String(v);
  };
  const m = (v: unknown) => (v == null ? "" : `$${Number(v).toFixed(2)}`);
  put("ReservationNumber", r.number);
  put("ResNumber", r.number);
  put("ReservationID", r.number);
  put("ReservationDate", fmt(r.createdAt, tz, "both"));
  put("CheckoutDate", fmt(r.pickupAt, tz, "date"));
  put("CheckInDate", fmt(r.returnAt, tz, "date"));
  put("CheckOutTime", fmt(r.pickupAt, tz, "time"));
  put("CheckInTime", fmt(r.returnAt, tz, "time"));
  put("CheckOutLocation", r.pickupLocation.name);
  put("CheckInLocation", r.returnLocation.name);
  put("EnteredBy", r.createdBy?.name);
  put("LastModifiedDate", fmt(r.updatedAt, tz, "both"));
  put("Referal", r.referral?.name);
  put("AirLine", r.airline);
  put("Airport", r.arrivalAirport);
  put("Hotel", r.hotel);
  put("Deposit", r.deposit != null ? m(r.deposit) : "");
  put("CustomerNotes", r.customerNotes);
  put("CustomerEmail", r.email ?? r.customer?.email);
  put("LicenseExpiry", r.customer?.licenseExpiry ? fmt(r.customer.licenseExpiry, "UTC", "date") : "");
  put("IsConfirmed", r.status === "CONFIRMED" ? "Yes" : "No");
  put("IsCancelled", r.status === "CANCELLED" ? "Yes" : "No");
  put("IsCheckedOut", r.status === "CHECKED_OUT" ? "Yes" : "No");
  put("IsCheckedIn", r.status === "CHECKED_IN" ? "Yes" : "No");
  put("Netrate", r.rate?.code);
  put("DiscountType", r.discountType === "PERCENT" ? "%" : r.discountType === "AMOUNT" ? "$" : "");
  put("DiscountRate", r.discountValue != null ? Number(r.discountValue) : "");
  put("DiscountPercent", r.discountType === "PERCENT" && r.discountValue != null ? `${Number(r.discountValue)}%` : "");
  put("DiscountTotal", f.DiscountAmount);
  put("Fuel", f.FuelCharge);
  put("NumberOfRentalDays", f.RentalDays);
  put("WeeklyRate", f.Weeklyrate);
  put("MonthlyRate", f.Monthlyrate);
  const km = r.chargeLines.find((l) => l.kind === "MILEAGE" && !Number(l.total));
  put("KMAllowedDaily", km ? Number(km.units) : "");
  put("KMExceed", f.KMMilesCharged);
  r.chargeLines.filter((l) => l.kind === "OTHER").slice(0, 4).forEach((l, i) => {
    const n = i === 0 ? "" : String(i + 1);
    put(`OtherChargesAmount${n}`, m(l.total));
    put(`OtherChargesDetail${n}`, l.name);
  });
  const numbered = (kind: string, prefix: string) =>
    r.chargeLines.filter((l) => l.kind === kind).slice(0, 10).forEach((l, i) => {
      put(`${prefix}${i + 1}Description`, l.name);
      put(`${prefix}${i + 1}Amount`, m(l.total));
    });
  numbered("TAX", "Tax");
  numbered("PROTECTION", "Insurance");
  numbered("MISC", "MiscCharge");
  const sum = (kind: string) => r.chargeLines.filter((l) => l.kind === kind).reduce((a, l) => a + Number(l.total), 0);
  put("ReservationTaxes", m(sum("TAX")));
  put("ReservationInsurances", m(sum("PROTECTION")));
  put("ReservationMiscCharges", m(sum("MISC")));
  put("TotalAmount", f.TotalEstimatedCharges);
  put("TotalPayments", f.Renterpayments);
  put("CreditCardAmount", f.Auth);
  put("CreditCardNumber", f.CreditCardNumberDisplay);
  r.drivers.slice(0, 3).forEach((d, i) => {
    put(`AddDriver${i + 1}FirstName`, d.customer.firstName);
    put(`AddDriver${i + 1}LastName`, d.customer.lastName);
  });
  return f;
}

/** Quote printouts (QUOTE templates): the same fields, quote # as RANumber. */
export async function quoteTemplateFields(db: Db, quoteId: string) {
  const q = await db.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: {
      customer: true,
      company: true,
      vehicleType: true,
      pickupLocation: { include: locInclude },
      returnLocation: true,
      referral: true,
      createdBy: { select: { name: true } },
      rate: true,
      chargeLines: { orderBy: lineOrder, include: lineInclude },
      memos: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const [first, ...rest] = (q.contactName ?? "").split(" ");
  const f = Object.assign(await signatureFields(db, q.chargeLines, q.pickupAt), docFields({
    taxCodes: await taxCodesAt(db, q.pickupLocationId),
    raNumber: q.number,
    status: "QUOTE",
    location: q.pickupLocation,
    returnLocation: q.returnLocation,
    out: q.pickupAt,
    dueIn: q.returnAt,
    customer: q.customer ?? { firstName: q.firstName ?? first ?? "", lastName: q.lastName ?? rest.join(" "), phone: q.contactPhone },
    company: q.company,
    vehicleType: q.vehicleType,
    lines: q.chargeLines,
    payments: [],
    billSplits: [],
    discountType: q.discountType,
    discountValue: q.discountValue,
    rateCode: q.rate?.code,
    referral: q.referral?.name,
    openedBy: q.createdBy?.name,
    memo: q.memos[0]?.body,
  }));
  f.QuoteNumber = String(q.number);
  return f;
}
