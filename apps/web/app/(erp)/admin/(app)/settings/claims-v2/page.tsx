import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ClaimsV2List } from "../_components/claims-v2";

export const metadata = { title: "Claims Management V2" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Claims Management V2"
        description="Insurance claims: insurer, adjuster, repair shop, repair estimate and status, deductible, loss of use and diminished value."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Claims Management" }, { label: "Claims Management V2" }]}
      />
      <ClaimsV2List />
    </>
  );
}
