import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ChecklistList } from "../_components/checklist-settings";

export const metadata = { title: "Vehicle CheckList" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Vehicle CheckList" description="Checklists filled in on a vehicle for each booking (vehicle page › Vehicle Checklist)." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle Setup" }, { label: "Vehicle CheckList" }]} />
      <ChecklistList />
    </>
  );
}
