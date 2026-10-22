import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { CommissionsList } from "../_components/commissions-list";

export const metadata = { title: "Commissions" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Commissions"
        description="Every commission entered on a rental (rental › Commissions)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Financial / Commission Settings" }, { label: "Commissions" }]}
      />
      <CommissionsList />
    </>
  );
}
