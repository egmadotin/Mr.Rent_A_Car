import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { OneWayRatesList } from "../_components/one-way-settings";

export const metadata = { title: "One Way Rates" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="One Way Rates" description="The fee added as the One Way charge when a booking is returned to another region." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "One Way Rates" }]} />
      <OneWayRatesList />
    </>
  );
}
