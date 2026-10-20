import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { OneWayRegionsList } from "../_components/one-way-settings";

export const metadata = { title: "One Way Regions" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="One Way Regions" description="Groups of locations; one way fees are set from one region to another." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "One Way Regions" }]} />
      <OneWayRegionsList />
    </>
  );
}
