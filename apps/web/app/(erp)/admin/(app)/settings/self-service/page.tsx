import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { SelfServiceRentalSetup } from "../_components/self-service-settings";

export const metadata = { title: "Rental Setup" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rental Setup"
        description="Self-service registration form, rental management and advanced settings, per location."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Self Service & Car Share SetUp" }, { label: "Rental Setup" }]}
      />
      <SelfServiceRentalSetup />
    </>
  );
}
