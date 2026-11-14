import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RatesCalendar } from "../_components/rate-controls";

export const metadata = { title: "Rates Calendar" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rates Calendar"
        description="Each rate's daily price per vehicle type for a range of days: the master rates, or with blocks and adjustments applied."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Rates Calendar" }]}
      />
      <RatesCalendar />
    </>
  );
}
