import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { GroupsManager } from "./groups-manager";

export const metadata = { title: "User Groups" };

/** Settings > Users > User Groups (AdminGroupsMain.aspx / AdminGroupsModify.aspx). */
export default async function UserGroupsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="User Groups & Permissions"
        description="What each group may do — RentCentric's permission list. Users with Full Admin can do everything."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Users" }, { label: "User Groups" }]}
      />
      <GroupsManager />
    </>
  );
}
