import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { SeasonsTaxes } from "../_components/seasons-taxes";

export const metadata = { title: "Taxes" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Taxes" description="Percentage taxes apply to the subtotal; fixed-amount taxes (per day or once) are added before it." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Taxes" }]} />
      <SeasonsTaxes view="taxes" />
    </>
  );
}
