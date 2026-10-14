import { PageHeader } from "../../../../_components/page-header";
import { workingLocationId } from "../../../../_lib/session";
import { ChargeList } from "../_components/charge-list";

export const metadata = { title: "Insurance coverage" };

export default async function Page() {
  const loc = await workingLocationId();
  return (
    <>
      <PageHeader title="Insurance coverage" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Insurance coverage" }]} />
      <ChargeList kind="insurance" defaultLocationId={loc} />
    </>
  );
}
