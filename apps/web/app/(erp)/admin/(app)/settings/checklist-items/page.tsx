import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ChecklistItemsList } from "../_components/checklist-settings";

export const metadata = { title: "Vehicle CheckList Items" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Vehicle CheckList Items" description="The items of each Vehicle CheckList, with a status color." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle Setup" }, { label: "Vehicle CheckList Items" }]} />
      <ChecklistItemsList />
    </>
  );
}
