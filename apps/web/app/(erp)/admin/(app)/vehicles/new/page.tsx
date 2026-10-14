import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { requireStaff } from "../../../../_lib/session";
import { VehicleForm } from "./vehicle-form";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  const session = await requireStaff();
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
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
