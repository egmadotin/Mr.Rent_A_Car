import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RentalPoliciesSettings } from "../_components/rental-policies-settings";

export const metadata = { title: "Rental Policies" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rental Policies"
        description="Master Policies: shown to online customers on the booking's last step, before “I accept the rental policy”."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Rental Policies" }]}
      />
      <RentalPoliciesSettings />
    </>
  );
}
