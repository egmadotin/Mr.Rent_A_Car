import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { PickList, type LookupKind } from "../../_components/setup-settings";

/** Settings pick lists that are just names: one page per RentCentric setting. */
const LISTS: Record<string, { kind: LookupKind; title: string; noun: string; section: string; description: string }> = {
  categories: { kind: "VEHICLE_CATEGORY", title: "Categories", noun: "Category", section: "Vehicle Setup", description: "Vehicle categories offered on the vehicle form." },
  "body-types": { kind: "VEHICLE_BODY", title: "Body Types", noun: "Body type", section: "Vehicle Setup", description: "Body types offered on the vehicle form (Car, SUV, Minivan, …)." },
  "fuel-types": { kind: "FUEL_TYPE", title: "Fuel Types", noun: "Fuel type", section: "Vehicle Setup", description: "Fuel types offered on the vehicle form." },
  "engine-brands": { kind: "ENGINE_BRAND", title: "Engine Brands", noun: "Engine brand", section: "Vehicle Setup", description: "Engine brands offered on the vehicle form." },
  "engine-types": { kind: "ENGINE_TYPE", title: "Engine Types", noun: "Engine type", section: "Vehicle Setup", description: "Engine types offered on the vehicle form." },
  "vehicle-options": { kind: "VEHICLE_OPTION", title: "Vehicle Options", noun: "Option", section: "Vehicle Setup", description: "Features a vehicle can have (Tow Hitch, Satellite Radio, …)." },
  "company-types": { kind: "COMPANY_TYPE", title: "Company Type", noun: "Company type", section: "Company", description: "Types offered on the company form." },
  regions: { kind: "CUSTOMER_REGION", title: "Customer Areas/Regions", noun: "Region", section: "Location Information", description: "Areas offered on the customer form." },
  "discount-reasons": { kind: "DISCOUNT_REASON", title: "Discount Reasons", noun: "Reason", section: "Rates", description: "Reasons offered next to Discount on quotes, reservations and rentals." },
  "rental-reasons": { kind: "RENTAL_REASON", title: "Rental Reasons", noun: "Reason", section: "Rates", description: "Reasons offered on the rental form." },
  "payment-details": { kind: "PAYMENT_DETAIL", title: "Payment Details", noun: "Detail", section: "Payment Settings", description: "Detail choices on Add/Edit Other Charges." },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: LISTS[(await params).slug]?.title ?? "Settings" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const l = LISTS[(await params).slug];
  if (!l) notFound();
  return (
    <>
      <PageHeader title={l.title} description={l.description} breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: l.section }, { label: l.title }]} />
      <PickList kind={l.kind} noun={l.noun} />
    </>
  );
}
