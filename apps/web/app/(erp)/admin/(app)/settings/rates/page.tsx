import { PageHeader } from "../../../../_components/page-header";
import { workingLocationId } from "../../../../_lib/session";
import { RatesList } from "./rates-list";

export const metadata = { title: "Master rates" };

export default async function Page() {
  const loc = await workingLocationId();
  return (
    <>
      <PageHeader title="Master rates" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Master rates" }]} />
      <RatesList defaultLocationId={loc} />
    </>
  );
}
