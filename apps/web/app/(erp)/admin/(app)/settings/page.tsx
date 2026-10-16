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
    { label: "Hours Of Operation", desc: "Opening hours per weekday" },
    { label: "Upload Logo" },
    { label: "Customer Areas/Regions" },
  ] },
  { title: "Users", items: [{ label: "Users" }, { label: "User Groups & Permissions" }] },
  { title: "Rates", items: [
    { label: "Master Rates", href: "/admin/settings/rates", desc: "Rate codes, min/max length, seasons and per-type prices" },
    { label: "Master Rate Batch Update" },
    { label: "Rate Values Update" },
    { label: "Rate Blocking" },
    { label: "Rate Utilization" },
    { label: "Rates Calendar" },
    { label: "Overbooking Control" },
    { label: "Rates Setup" },
    { label: "Seasons", href: "/admin/settings/seasons", desc: "Date windows used by seasonal rates" },
    { label: "Taxes", href: "/admin/settings/taxes", desc: "GST, PST, rental tax and where they apply" },
    { label: "Miscellaneous Charges", href: "/admin/settings/misc-charges", desc: "Fees and extras: defaults, online options, under-age, one-way …" },
    { label: "Insurance Coverage", href: "/admin/settings/insurances", desc: "Protections: damage waivers, SLC, No Protection" },
    { label: "One Way Rates" },
    { label: "Pay Now Discounts" },
  ] },
  { title: "Company", items: [{ label: "Companies / Corporates" }, { label: "Company Type" }, { label: "Partner Login Setup" }] },
  { title: "Import Data and Other Tools", items: [
    { label: "Customer Import" }, { label: "Company Import" }, { label: "Rate Import" }, { label: "Reservation Import" },
    { label: "Referral Import" }, { label: "Vehicle Import" }, { label: "Copy Location Setup" }, { label: "Renew Rental Agreements" },
  ] },
  { title: "Payment Settings", items: [{ label: "Payment Gateway", href: "/admin/settings/payment-gateway", desc: "Stripe keys (admins only), test / live, what online bookings do with the card" }, { label: "Payment Methods" }] },
  { title: "Rental Contracts & Invoices", items: [{ label: "Rentals & Invoices", href: "/admin/settings/templates", desc: "Printouts: Open Contract, invoices, closing forms, reservation confirmation (editable HTML)" }] },
  { title: "Vehicle Setup", items: [
    { label: "Vehicle Types", href: "/admin/settings/vehicle-types", desc: "Classes, photos and which locations show them online" }, { label: "SIPP Codes" }, { label: "Makes & Models" }, { label: "Categories" }, { label: "Body Types" },
    { label: "Fuel Types" }, { label: "Vehicle Options" }, { label: "Engine Brands & Types" }, { label: "Damage Setup" },
  ] },
  { title: "Equipment Setup", items: [{ label: "Equipment" }] },
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
