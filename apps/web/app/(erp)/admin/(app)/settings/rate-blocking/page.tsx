import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RateRules } from "../_components/rate-controls";

export const metadata = { title: "Rate Blocking" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rate Blocking"
        description="Stop a rate from being offered for pickups on chosen dates and weekdays, at one location (all its rates, or one rate code / vehicle type)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Rate Blocking" }]}
      />
      <RateRules kind="BLOCK" />
    </>
  );
}
