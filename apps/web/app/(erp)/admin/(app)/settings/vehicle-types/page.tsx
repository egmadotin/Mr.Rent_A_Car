import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { VehicleTypesList } from "../_components/vehicle-types-settings";

export const metadata = { title: "Vehicle types" };

export default async function VehicleTypesPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Vehicle types"
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle types" }]}
        description="Rental classes (Economy, Compact SUV …) and the locations that offer them online."
      />
      <VehicleTypesList />
    </>
  );
}
