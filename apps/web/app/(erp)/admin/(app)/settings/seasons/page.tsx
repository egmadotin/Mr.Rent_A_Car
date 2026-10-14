import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { SeasonsTaxes } from "../_components/seasons-taxes";

export const metadata = { title: "Seasons" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Seasons" description="Date windows that seasonal rates price against. Years are ignored — seasons repeat every year." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Seasons" }]} />
      <SeasonsTaxes view="seasons" />
    </>
  );
}
