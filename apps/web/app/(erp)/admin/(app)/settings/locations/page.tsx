import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { LocationsSettings } from "../_components/locations-settings";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Locations"
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Locations" }]}
        description="Name, address and contact details. “On website” locations appear in the public site’s location pickers and Fleet page."
      />
      <LocationsSettings />
    </>
  );
}
