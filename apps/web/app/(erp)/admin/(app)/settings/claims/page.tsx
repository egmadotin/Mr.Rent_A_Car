import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ClaimsManagement } from "../_components/claims-settings";

export const metadata = { title: "Claims Management" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Claims Management" description="Every claim on rentals and vehicles." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Claims Management" }]} />
      <ClaimsManagement />
    </>
  );
}
