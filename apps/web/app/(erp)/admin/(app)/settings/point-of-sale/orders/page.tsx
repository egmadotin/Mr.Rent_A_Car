import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { PosOrders } from "../../_components/point-of-sale";

export const metadata = { title: "Orders" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Orders"
        description="Enter and manage merchandise invoices and orders you sell to clients."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Point Of Sale" }, { label: "Orders" }]}
      />
      <PosOrders />
    </>
  );
}
