import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { ChargeForm } from "../../_components/charge-form";

export const metadata = { title: "New misc. charge" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New misc. charge" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Miscellaneous charges", href: "/admin/settings/misc-charges" }, { label: "New" }]} />
      <ChargeForm kind="misc" />
    </>
  );
}
