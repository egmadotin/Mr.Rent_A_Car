import type { Prisma } from "@mrac/db";
import { TEMPLATE_CODES } from "./template-codes";
import { rentalTotals } from "./totals";

type Db = Prisma.TransactionClient;
type Fields = Record<string, string>;

const money = (v: unknown) => (v == null || v === "" ? "" : `$${Number(v).toFixed(2)}`);
const num = (v: unknown) => (v == null ? "" : String(Number(v)));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmt(d: Date | null | undefined, tz: string, part: "date" | "time" | "both") {
  if (!d) return "";
  const date = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric", day: "numeric", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return part === "date" ? date : part === "time" ? time : `${date} ${time}`;
}

/** Fill RentCentric ##code## placeholders (numbers, or a field name) from `fields`; unknown codes print empty. */
export function renderTemplate(html: string, fields: Fields, raw: Set<string> = new Set()) {
  return html.replace(/##([0-9A-Za-z\\]+)##/g, (_, code: string) => {
    const name = TEMPLATE_CODES[code] ?? code;
    const v = fields[name] ?? "";
    return raw.has(name) ? v : esc(v);
  });
}

/** The legacy charge table (ChargesSummaryTable / Invoice\chargesSummary): Charge, Unit, Rate, Total, then totals and payments. */
function chargesTable(lines: { name: string; kind: string; units: unknown; rate: unknown; total: unknown; tax?: { kind: string } | null }[], totals: ReturnType<typeof rentalTotals>, payments: { method: string; amount: unknown; transactionType: string; cardLast4: string | null }[]) {
  const row = (a: string, u = "", r = "", t = "") => `<tr><td>${esc(a)}</td><td style="text-align:right">${u}</td><td style="text-align:right">${r}</td><td style="text-align:right">${t}</td></tr>`;
  const body = lines
    .filter((l) => !(l.kind === "MILEAGE" && !Number(l.total)))
    .map((l) => row(l.name, Number(l.units) ? num(l.units) : "", l.kind === "TAX" && l.tax?.kind !== "AMOUNT" ? `${Number(l.rate)}%` : Number(l.rate) ? money(l.rate) : "", money(l.total)))
    .join("");
  const pays = payments.map((p) => row(`${p.method}${p.cardLast4 ? ` XXXX${p.cardLast4}` : ""}${p.transactionType === "AUTHORIZATION" ? " (A)" : ""}`, "", "", money(p.transactionType === "REFUND" ? -Number(p.amount) : p.amount))).join("");
  return `<table class="charges-summary" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Charge</th><th style="text-align:right">Unit</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead><tbody>${body}${row("Total", "", "", money(totals.total))}${pays}${row("Total Payments", "", "", money(totals.totalPayments))}${row("Balance", "", "", money(totals.balance))}</tbody></table>`;
}

const rentalInclude = {
  customer: true,
  company: true,
  vehicle: { include: { make: true, model: true, vehicleType: true } },
  vehicleType: true,
  checkOutLocation: true,
  checkInLocation: true,
  referral: true,
  openedBy: { select: { name: true } },
  rate: true,
  chargeLines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { tax: { select: { kind: true } }, insurance: { select: { code: true, deductible: true } }, miscCharge: { select: { code: true } } } },
  payments: { orderBy: { takenAt: "asc" }, include: { creditCard: true } },
  drivers: { include: { customer: true } },
  memos: { where: { kind: "MEMO" }, orderBy: { createdAt: "desc" }, take: 1 },
  billSplits: { include: { company: true } },
} satisfies Prisma.RentalInclude;

/** Every template field we can fill for a rental (names as in RentCentric's field tree). */
export async function rentalTemplateFields(db: Db, rentalId: string) {
  const r = await db.rental.findUniqueOrThrow({ where: { id: rentalId }, include: rentalInclude });
  const tz = r.checkOutLocation.timeZone;
  const totals = rentalTotals(r.chargeLines, r.payments, r.billSplits);
  const c = r.customer;
  const loc = r.checkOutLocation;
  const co = r.company;
  const f: Fields = {};
  const set = (k: string, v: unknown) => {
    f[k] = v == null ? "" : String(v);
  };

  // agreement
  set("RANumber", r.raNumber);
  set("ClaimNumber", r.claimNumber);
  set("RepairOrderNumber", r.roNumber);
  set("AgreementPONumber", r.poNumber);
  const status = r.status === "OPEN" ? "OPEN" : r.status === "CLOSED" ? "CLOSED" : "VOID";
  set("RentalStatus", status);
  set("LabelRentalStatus", status);
  set("Referral", r.referral?.name);
  set("OpenedBy", r.openedBy?.name);
  set("Memo", r.memos[0]?.body);
  set("DropOffLocation", r.checkInLocation.name);
  set("CurrentDate", fmt(new Date(), tz, "date"));
  // dates
  const dateIn = r.checkedInAt ?? null;
  set("DateOut", fmt(r.checkOutAt, tz, "both"));
  set("DateIn", fmt(dateIn, tz, "both"));
  set("DateDueIn", fmt(r.expectedReturnAt, tz, "both"));
  set("CheckOutTime", fmt(r.checkOutAt, tz, "time"));
  set("DateOutWithoutTime", fmt(r.checkOutAt, tz, "date"));
  set("CheckInTime", fmt(dateIn ?? r.expectedReturnAt, tz, "time"));
  set("DateInWithoutTime", fmt(dateIn ?? r.expectedReturnAt, tz, "date"));
  set("RentalDays", Math.max(1, Math.ceil((+(dateIn ?? r.expectedReturnAt) - +r.checkOutAt) / 86_400_000)));
  // odometer / fuel
  set("OdometerOut", r.odometerOut);
  set("OdometerIn", r.odometerIn);
  set("TotalKMDriven", r.odometerIn != null ? r.odometerIn - r.odometerOut : "");
  set("FuelLevelOut", r.fuelOut != null ? `${r.fuelOut}/16` : "");
  set("FuelLevelIn", r.fuelIn != null ? `${r.fuelIn}/16` : "");
  set("UsedFuel", r.fuelIn != null && r.fuelOut != null ? `${Math.max(0, r.fuelOut - r.fuelIn)}/16` : "");
  set("FuelRate", "");
  // customer
  set("CustomerFirstName", c.firstName);
  set("CustomerLastName", c.lastName);
  set("CustomerAddress", [c.address1, c.address2].filter(Boolean).join(" "));
  set("CustomerCity", c.city);
  set("CustomerStateCode", c.province);
  set("CustomerZIP", c.postal);
  set("CustomerCountry", c.country);
  set("CustomerPhone", c.phone);
  set("CustomerBirthDate", c.birthDate ? fmt(c.birthDate, "UTC", "date") : "");
  set("DrviserLicenseNumber", c.licenseNumber);
  set("DriverLicenseStateCode", c.licenseProvince);
  set("DriverLicenseStateName", c.licenseProvince);
  // additional drivers
  r.drivers.slice(0, 5).forEach((d, i) => {
    const p = `AddDriver${i + 1}`;
    set(`${p}Name`, `${d.customer.firstName} ${d.customer.lastName}`);
    set(`${p}FirstName`, d.customer.firstName);
    set(`${p}LastName`, d.customer.lastName);
    set(`${p}DOB`, d.customer.birthDate ? fmt(d.customer.birthDate, "UTC", "date") : "");
    set(`${p}LicenseNumber`, d.customer.licenseNumber);
    set(`${p}LicenseStateCode`, d.customer.licenseProvince);
    set(`${p}LicenseStateName`, d.customer.licenseProvince);
    set(`${p}LicenseExp`, d.customer.licenseExpiry ? fmt(d.customer.licenseExpiry, "UTC", "date") : "");
    set(`${p}Address`, d.customer.address1);
    set(`${p}City`, d.customer.city);
    set(`${p}Phone`, d.customer.phone);
  });
  // location
  set("LocationName", loc.name);
  set("LocationAddress", [loc.address1, loc.address2].filter(Boolean).join(" "));
  set("LocationCity", loc.city);
  set("LocationState", loc.province);
  set("LocationZIP", loc.postal);
  set("LocationPhone", loc.phone);
  set("LocationFax", loc.fax);
  set("LocationWebSite", "www.mrrentacar.com");
  set("LocationFullAddress", [loc.address1, loc.city, loc.province, loc.postal].filter(Boolean).join(", "));
  // vehicle
  const v = r.vehicle;
  set("AssignedID", v.assignedId);
  set("Year", v.year);
  set("Make", v.make.name);
  set("Model", v.model.name);
  set("VehicleLicenseNumber", v.licenseNumber);
  set("VINNumber", v.vin);
  set("Color", v.colour);
  set("NumberOfDoors", v.doors ?? r.vehicleType.doors);
  set("NumberOfPassengers", r.vehicleType.seats);
  f.VehicleTypeImage = r.vehicleType.imageKey ? `<img src="${esc(r.vehicleType.imageKey)}" alt="" style="max-width:160px" />` : "";
  set("VehicleType", r.vehicleType.name);
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
  set("BillToCompany", co?.name);

  // charges by unit (legacy names: Hourly / Daily / Extra Daily / Weekly / Monthly)
  const line = (name: string) => r.chargeLines.find((l) => l.kind === "TIME" && l.name.toLowerCase() === name.toLowerCase());
  for (const [label, unitsKey, rateKey, totalKey] of [
    ["Hourly", "TotalHours", "HourlyRate", "HourlyTotal"],
    ["Daily", "TotalDayes", "DailyRate", "DailyTotal"],
    ["Extra Daily", "ExtraDayes", "ExtraDailyRate", "ExtraDailyTotal"],
    ["Weekly", "TotalWeeks", "Weeklyrate", "WeeklyTotal"],
    ["Monthly", "TotalMonthes", "Monthlyrate", "MonthlyTotal"],
  ] as const) {
    const l = line(label);
    set(unitsKey, l ? num(l.units) : "");
    set(rateKey, l ? money(l.rate) : "");
    set(totalKey, l ? money(l.total) : "");
  }
  const mileage = r.chargeLines.filter((l) => l.kind === "MILEAGE");
  const allowed = mileage.find((l) => !Number(l.total));
  set("TotalMilesAllowed", allowed ? num(allowed.units) : "");
  const extraKm = mileage.find((l) => Number(l.total));
  set("KMEExceed", extraKm ? num(extraKm.units) : "");
  set("KMMilesCharged", extraKm ? money(extraKm.rate) : "");
  set("KMExceedCharge", extraKm ? money(extraKm.total) : "");
  set("TotalTimeAndMileAges", money(totals.timeAndKm));
  set("TotalTimeAndMileAgesInLocalCurrency", money(totals.timeAndKm));
  const sumOf = (...kinds: string[]) => r.chargeLines.filter((l) => kinds.includes(l.kind)).reduce((a, l) => a + Number(l.total), 0);
  set("DiscountAmount", sumOf("DISCOUNT") ? money(sumOf("DISCOUNT")) : "");
  set("DiscountPercentage", r.discountType === "PERCENT" && r.discountValue ? `${Number(r.discountValue)}%` : "");
  set("FuelCharge", sumOf("FUEL", "PREPAID_FUEL") ? money(sumOf("FUEL", "PREPAID_FUEL")) : "");
  set("Damages", sumOf("DAMAGES") ? money(sumOf("DAMAGES")) : "");
  set("TrafficTicket", sumOf("TRAFFIC_TICKETS") ? money(sumOf("TRAFFIC_TICKETS")) : "");
  set("OneWayFee", sumOf("ONE_WAY") ? money(sumOf("ONE_WAY")) : "");
  set("NetRate", r.rate?.code);
  // numbered protections / misc charges / taxes / other charges
  const ins = r.chargeLines.filter((l) => l.kind === "PROTECTION");
  ins.slice(0, 8).forEach((l, i) => {
    set(`Insurance${i + 1}Code`, l.insurance?.code ?? l.name);
    set(`Insurance${i + 1}Name`, l.name);
    set(`Insurance${i + 1}Value`, money(l.total));
    set(`Insurance${i + 1}ValueInLocalCurrency`, money(l.total));
  });
  const deductible = ins.find((l) => l.insurance?.deductible != null)?.insurance?.deductible;
  set("LDWDeductible", deductible != null ? money(deductible) : "");
  set("AgreementInsurancesDetuctible", deductible != null ? money(deductible) : "");
  r.chargeLines.filter((l) => l.kind === "MISC").slice(0, 12).forEach((l, i) => {
    set(`MiscCharge${i + 1}Code`, l.miscCharge?.code ?? l.name);
    set(`MiscCharge${i + 1}Name`, l.name);
    set(`MiscCharge${i + 1}Amount`, money(l.total));
  });
  r.chargeLines.filter((l) => l.kind === "TAX").slice(0, 8).forEach((l, i) => {
    set(`Tax${i + 1}Code`, l.tax?.kind === "AMOUNT" ? money(l.rate) : `${Number(l.rate)}%`);
    set(`Tax${i + 1}Name`, l.name);
    set(`Tax${i + 1}Amount`, money(l.total));
  });
  r.chargeLines.filter((l) => l.kind === "OTHER").slice(0, 4).forEach((l, i) => {
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
  const auth = r.payments.find((p) => p.transactionType === "AUTHORIZATION") ?? r.payments[0];
  set("PaymentType", auth?.method);
  set("CCType", auth?.creditCard?.brand ?? auth?.method);
  set("CreditCardNumberDisplay", auth?.cardLast4 ? `XXXX${auth.cardLast4}` : "");
  set("AuthCode", auth?.authorizationCode);
  set("Auth", auth ? money(auth.amount) : "");
  set("CCExpiry", auth?.creditCard ? `${String(auth.creditCard.expMonth).padStart(2, "0")}/${auth.creditCard.expYear}` : "");
  f.ChargesSummaryTable = chargesTable(r.chargeLines, totals, r.payments);
  f["Invoice\\chargesSummary"] = f.ChargesSummaryTable;
  return f;
}

/** Fields whose values are HTML (not escaped when rendered). */
export const HTML_FIELDS = new Set(["ChargesSummaryTable", "Invoice\\chargesSummary", "VehicleTypeImage"]);
