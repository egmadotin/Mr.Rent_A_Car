import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { PaymentMethodsSettings } from "../_components/payment-methods-settings";

export const metadata = { title: "Payment Methods" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Payment Methods" description="Each location's own payment methods and its default payment method." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Payment Settings" }, { label: "Payment Methods" }]} />
      <PaymentMethodsSettings />
    </>
  );
}
