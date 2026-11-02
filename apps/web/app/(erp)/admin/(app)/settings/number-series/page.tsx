import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { NumberSeriesForm } from "./number-series-form";

export const metadata = { title: "Number Series" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Number Series"
        description="Give each location its own numbers for quotes, reservations and rental agreements, e.g. Burnaby from 100001 and Richmond from 200001. Only admins can change it."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Location Information" }, { label: "Number Series" }]}
      />
      <NumberSeriesForm />
    </>
  );
}
