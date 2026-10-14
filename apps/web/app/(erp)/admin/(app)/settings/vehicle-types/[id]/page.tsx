import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { VehicleTypeForm } from "../../_components/vehicle-types-settings";

export const metadata = { title: "Edit vehicle type" };

export default async function EditVehicleTypePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Edit vehicle type"
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle types", href: "/admin/settings/vehicle-types" }, { label: "Edit" }]}
      />
      <VehicleTypeForm id={id} />
    </>
  );
}
