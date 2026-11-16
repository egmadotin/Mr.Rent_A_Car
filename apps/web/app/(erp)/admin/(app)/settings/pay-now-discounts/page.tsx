import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { PayNowDiscounts } from "../_components/pay-now-discounts";

export const metadata = { title: "Pay Now Discounts" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Pay Now Discounts"
        description="A discount for a rate (and vehicle types) between two dates when the customer pays at booking."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Pay Now Discounts" }]}
      />
      <PayNowDiscounts />
    </>
  );
}
