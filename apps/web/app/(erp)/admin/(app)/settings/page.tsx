import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { SettingsIndex, type SettingsCategory } from "./settings-index";

export const metadata = { title: "Settings" };

/**
 * Same 17 categories and page names as RentCentric Settings (LocationsMainSettings2.aspx), so staff
 * find things where they expect them. Pages not built yet are listed (searchable) and marked.
 */
const CATEGORIES: SettingsCategory[] = [
  { title: "Location Information", items: [
    { label: "Locations", href: "/admin/settings/locations", desc: "Location name, address, phone, active and on-website flags" },
    { label: "Add Location" },
    { label: "Offsite Locations", desc: "Additional pickup/return points that are not full locations" },
    { label: "Hours Of Operation", href: "/admin/settings/hours", desc: "Opening hours per weekday" },
    { label: "Upload Logo" },
    { label: "Customer Areas/Regions", href: "/admin/settings/lists/regions" },
  ] },
  { title: "Users", items: [{ label: "Users", href: "/admin/settings/users", desc: "Staff accounts: group, default location, admin, active, password reset" }, { label: "User Groups & Permissions", href: "/admin/settings/user-groups", desc: "What each group may do (RentCentric's permission list), max discount, location" }] },
  { title: "Rates", items: [
    { label: "Master Rates", href: "/admin/settings/rates", desc: "Rate codes, min/max length, seasons and per-type prices" },
    { label: "Master Rate Batch Update" },
    { label: "Rate Values Update" },
    { label: "Rate Blocking" },
    { label: "Rate Utilization" },
    { label: "Rates Calendar" },
    { label: "Overbooking Control" },
    { label: "Rates Setup" },
    { label: "Seasons", href: "/admin/settings/seasons", desc: "Date windows used by seasonal rates" }, { label: "Discount Reasons", href: "/admin/settings/lists/discount-reasons" }, { label: "Rental Reasons", href: "/admin/settings/lists/rental-reasons" },
    { label: "Taxes", href: "/admin/settings/taxes", desc: "GST, PST, rental tax and where they apply" },
    { label: "Miscellaneous Charges", href: "/admin/settings/misc-charges", desc: "Fees and extras: defaults, online options, under-age, one-way …" },
    { label: "Insurance Coverage", href: "/admin/settings/insurances", desc: "Protections: damage waivers, SLC, No Protection" },
    { label: "One Way Rates", href: "/admin/settings/one-way-rates", desc: "Fee between regions when a booking returns elsewhere" },
    { label: "One Way Regions", href: "/admin/settings/one-way-regions", desc: "Which locations form each one way region" },
    { label: "Pay Now Discounts" },
  ] },
  { title: "Company", items: [{ label: "Companies / Corporates", href: "/admin/settings/companies", desc: "Corporate, insurance and partner accounts" }, { label: "Company Type", href: "/admin/settings/lists/company-types" }, { label: "Partner Login Setup" }] },
  { title: "Import Data and Other Tools", items: [
    { label: "Customer Import" }, { label: "Company Import" }, { label: "Rate Import" }, { label: "Reservation Import" },
    { label: "Referral Import" }, { label: "Vehicle Import" }, { label: "Copy Location Setup" }, { label: "Renew Rental Agreements" },
  ] },
  { title: "Payment Settings", items: [{ label: "Payment Gateway", href: "/admin/settings/payment-gateway", desc: "Stripe keys (admins only), test / live, what online bookings do with the card" }, { label: "Payment Methods", href: "/admin/settings/payment-methods", desc: "Each location's own methods (e.g. Cheque) and its default" }, { label: "Default Payment Method", href: "/admin/settings/payment-methods" }, { label: "Payment Details", href: "/admin/settings/lists/payment-details", desc: "Detail choices on Add/Edit Other Charges" }] },
  { title: "Rental Contracts & Invoices", items: [{ label: "Rentals & Invoices", href: "/admin/settings/templates", desc: "Printouts: Open Contract, invoices, closing forms, reservation confirmation (editable HTML)" }, { label: "Signature And Initials", href: "/admin/settings/signatures", desc: "Disclaimers with a signature / initials line, shown when a charge is (not) added" }] },
  { title: "Vehicle Setup", items: [
    { label: "Vehicle Types", href: "/admin/settings/vehicle-types", desc: "Classes, photos and which locations show them online" }, { label: "SIPP Codes" }, { label: "Makes & Models", href: "/admin/settings/makes" }, { label: "Categories", href: "/admin/settings/lists/categories" }, { label: "Body Types", href: "/admin/settings/lists/body-types" },
    { label: "Fuel Types", href: "/admin/settings/lists/fuel-types" }, { label: "Vehicle Options", href: "/admin/settings/lists/vehicle-options" }, { label: "Engine Brands", href: "/admin/settings/lists/engine-brands" }, { label: "Engine Types", href: "/admin/settings/lists/engine-types" }, { label: "Damage Locations", href: "/admin/settings/lists/damage-locations", desc: "Damage Setup" }, { label: "Damage Conditions", href: "/admin/settings/lists/damage-conditions", desc: "Damage Setup" }, { label: "Vehicle CheckList", href: "/admin/settings/checklists" }, { label: "Vehicle CheckList Items", href: "/admin/settings/checklist-items" },
  ] },
  { title: "Equipment Setup", items: [{ label: "Equipment", href: "/admin/settings/equipment" }] },
  { title: "Self Service & Car Share SetUp", items: [{ label: "Self Service" }, { label: "Car Share" }] },
  { title: "Claims Management", items: [{ label: "Claims Management" }, { label: "Claims Management V2" }] },
  { title: "Financial / Commission Settings", items: [{ label: "Commissions" }, { label: "Financial Settings" }] },
  { title: "Website & Email Setup", items: [{ label: "Website Design V3" }, { label: "Add/Edit Webpages" }, { label: "Widget/Rotator Setup" }, { label: "Email Setup", href: "/admin/settings/email", desc: "SMTP account for agreements, invoices, confirmations and quotes (admins only)" }] },
  { title: "SMS Notification", items: [{ label: "SMS Notification" }] },
  { title: "Point Of Sale", items: [{ label: "Point Of Sale" }] },
  { title: "Email Marketing", items: [{ label: "Email Marketing" }] },
  { title: "Tasks Messages", items: [{ label: "Tasks Messages" }] },
];

export default async function SettingsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Settings" description="Same categories as the old system, with search across every page." />
      <SettingsIndex categories={CATEGORIES} />
    </>
  );
}
