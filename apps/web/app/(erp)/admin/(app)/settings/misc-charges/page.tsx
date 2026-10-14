import { PageHeader } from "../../../../_components/page-header";
import { workingLocationId } from "../../../../_lib/session";
import { ChargeList } from "../_components/charge-list";

export const metadata = { title: "Miscellaneous charges" };

export default async function Page() {
  const loc = await workingLocationId();
  return (
    <>
      <PageHeader title="Miscellaneous charges" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Miscellaneous charges" }]} />
      <ChargeList kind="misc" defaultLocationId={loc} />
    </>
  );
}
