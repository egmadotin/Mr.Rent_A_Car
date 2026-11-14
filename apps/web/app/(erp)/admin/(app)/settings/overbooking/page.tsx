import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { OverbookingControl } from "../_components/rate-controls";

export const metadata = { title: "Overbooking Control" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Overbooking Control"
        description="Let a vehicle type keep taking online bookings past its free cars for chosen dates."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Overbooking Control" }]}
      />
      <OverbookingControl />
    </>
  );
}
