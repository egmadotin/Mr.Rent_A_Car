import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RatesSetupForm } from "../_components/rates-setup";

export const metadata = { title: "Rates Setup" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rates Setup"
        description="Rate Ratios to the daily rate: entering a Daily price on a rate fills its empty Hourly, Extra Daily, Weekly and Monthly prices."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Setup" }]}
      />
      <RatesSetupForm />
    </>
  );
}
