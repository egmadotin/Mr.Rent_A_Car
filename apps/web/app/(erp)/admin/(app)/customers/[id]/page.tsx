import { requireStaff } from "../../../../_lib/session";
import { CustomerDetail } from "./customer-detail";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  return <CustomerDetail customerId={id} />;
}
