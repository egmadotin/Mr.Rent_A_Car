import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RateRules } from "../_components/rate-controls";

export const metadata = { title: "Rate Values Update" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rate Values Update"
        description="Raise or lower the daily rate for chosen dates and weekdays (holidays, events, quiet periods) without changing the master rate."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Rate Values Update" }]}
      />
      <RateRules kind="ADJUST" />
    </>
  );
}
