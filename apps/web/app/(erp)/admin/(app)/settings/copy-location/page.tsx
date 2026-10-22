import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { LocationCopy } from "../_components/location-copy";

export const metadata = { title: "Copy Location Setup" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Copy Location Setup"
        description="Copy one location's insurances, charges, taxes, rates, payment methods, forms, vehicle types and hours to other locations."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Import Data and Other Tools" }, { label: "Copy Location Setup" }]}
      />
      <LocationCopy />
    </>
  );
}
