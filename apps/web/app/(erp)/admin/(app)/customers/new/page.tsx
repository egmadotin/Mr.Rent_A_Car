import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { requireStaff } from "../../../../_lib/session";
import { CustomerForm } from "../_components/customer-form";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const session = await requireStaff();
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader title="Add customer" breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: "Add" }]} />
      <CustomerForm defaultLocationId={locationId} />
    </>
  );
}
