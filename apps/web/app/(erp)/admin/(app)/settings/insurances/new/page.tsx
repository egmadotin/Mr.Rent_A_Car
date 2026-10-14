import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { ChargeForm } from "../../_components/charge-form";

export const metadata = { title: "New coverage" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New coverage" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Insurance coverage", href: "/admin/settings/insurances" }, { label: "New" }]} />
      <ChargeForm kind="insurance" />
    </>
  );
}
