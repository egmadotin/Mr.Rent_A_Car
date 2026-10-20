import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { PromoSettings } from "../_components/promo-settings";

export const metadata = { title: "Promotions/Specials" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Promotions/Specials"
        description="Promo codes customers enter when booking online; a code that applies becomes the booking's discount."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Promotions/Specials" }]}
      />
      <PromoSettings />
    </>
  );
}
