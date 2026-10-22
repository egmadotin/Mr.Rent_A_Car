import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ImportData } from "../_components/import-data";

export const metadata = { title: "Import Data" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Import Data"
        description="Customer, Company, Rate, Referral, Vehicle and Model Import from RentCentric's CSV templates."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Import Data and Other Tools" }, { label: "Import Data" }]}
      />
      <ImportData />
    </>
  );
}
