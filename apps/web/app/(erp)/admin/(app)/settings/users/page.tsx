import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { UsersManager } from "./users-manager";

export const metadata = { title: "Users" };

/** Settings > Users (AdminsMain.aspx). Needs the "Users › View" permission (admins always). */
export default async function UsersPage() {
  const session = await requireStaff();
  return (
    <>
      <PageHeader title="Users" description="Staff who can sign in to the ERP, their user group and default location." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Users" }]} />
      <UsersManager meId={session.user.id} />
    </>
  );
}
