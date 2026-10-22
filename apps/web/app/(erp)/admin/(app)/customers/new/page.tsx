import { PageHeader } from "../../../../_components/page-header";
import { NoAccess } from "../../../../_components/no-access";
import { can, workingLocationId } from "../../../../_lib/session";
import { CustomerForm } from "../_components/customer-form";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  if (!(await can("CustomersAdd"))) return <NoAccess what="add customers" />;
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader title="Add customer" breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: "Add" }]} />
      <CustomerForm defaultLocationId={locationId} />
    </>
  );
}
