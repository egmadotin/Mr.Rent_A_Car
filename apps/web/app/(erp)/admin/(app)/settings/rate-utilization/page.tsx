import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RateUtilization } from "../_components/rate-controls";

export const metadata = { title: "Rate Utilization" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rate Utilization"
        description="Move the daily rate up or down automatically by how full the fleet is on the pickup day."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Rate Utilization" }]}
      />
      <RateUtilization />
    </>
  );
}
