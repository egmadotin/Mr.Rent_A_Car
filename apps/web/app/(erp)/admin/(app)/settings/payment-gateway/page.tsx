import { redirect } from "next/navigation";
import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { PaymentGatewayForm } from "./payment-gateway-form";

export const metadata = { title: "Payment Gateway" };

export default async function Page() {
  const session = await requireStaff();
  if ((session.user as { role?: string | null }).role !== "admin") redirect("/admin/settings");
  return (
    <>
      <PageHeader
        title="Payment Gateway"
        description="Stripe keys for card payments. Card numbers never touch this system: Stripe stores the card and we keep its last 4 digits and token."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Payment Settings" }, { label: "Payment Gateway" }]}
      />
      <PaymentGatewayForm />
    </>
  );
}
