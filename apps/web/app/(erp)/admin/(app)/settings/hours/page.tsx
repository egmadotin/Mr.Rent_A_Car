import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { HoursOfOperation } from "../_components/setup-settings";

export const metadata = { title: "Hours Of Operation" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Hours Of Operation" description="Opening hours per location, shown on the website and used for pickup and return times." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Location Information" }, { label: "Hours Of Operation" }]} />
      <HoursOfOperation />
    </>
  );
}
