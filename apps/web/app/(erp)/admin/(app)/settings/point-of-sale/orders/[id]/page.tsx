import { PageHeader } from "../../../../../../_components/page-header";
import { requireStaff } from "../../../../../../_lib/session";
import { PosOrderForm } from "../../../_components/point-of-sale";

export const metadata = { title: "Order" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  return (
    <>
      <PageHeader
        title={isNew ? "New Order/Sale" : "Edit Order"}
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Point Of Sale" }, { label: "Orders", href: "/admin/settings/point-of-sale/orders" }, { label: isNew ? "New Order/Sale" : "Edit Order" }]}
      />
      <PosOrderForm id={isNew ? undefined : id} />
    </>
  );
}
