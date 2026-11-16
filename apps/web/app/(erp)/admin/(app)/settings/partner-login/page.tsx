import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { PartnerLoginSetup } from "../_components/pay-now-discounts";

export const metadata = { title: "Partner Login Setup" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Partner Login Setup"
        description="What a partner (company account) is asked for when it books through its partner login."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Company" }, { label: "Partner Login Setup" }]}
      />
      <PartnerLoginSetup />
    </>
  );
}
