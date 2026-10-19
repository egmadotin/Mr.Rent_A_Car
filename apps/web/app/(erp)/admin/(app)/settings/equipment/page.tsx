import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { EquipmentList } from "../_components/setup-settings";

export const metadata = { title: "Equipment" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Equipment" description="Equipment kept in stock (child seats, GPS units, …)." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Equipment Setup" }, { label: "Equipment" }]} />
      <EquipmentList />
    </>
  );
}
