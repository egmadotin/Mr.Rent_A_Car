import { PageHeader } from "../../../../_components/page-header";
import { NoAccess } from "../../../../_components/no-access";
import { can, workingLocationId } from "../../../../_lib/session";
import { VehicleForm } from "./vehicle-form";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  if (!(await can("VehiclesAdd"))) return <NoAccess what="add vehicles" />;
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader
        title="Add vehicle"
        breadcrumbs={[{ label: "Vehicles", href: "/admin/vehicles" }, { label: "Add vehicle" }]}
        description="Fields marked * are required. Sections can be filled in any order."
      />
      <VehicleForm defaultLocationId={locationId} />
    </>
  );
}
