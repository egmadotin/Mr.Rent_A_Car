import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RenewRentals } from "../_components/renew-rentals";

export const metadata = { title: "Renew Rental Agreements" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Renew Rental Agreements"
        description="Find closed rental agreements and re-open them."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Import Data and Other Tools" }, { label: "Renew Rental Agreements" }]}
      />
      <RenewRentals />
    </>
  );
}
