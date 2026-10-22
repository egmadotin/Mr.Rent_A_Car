import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { CommissionStructures } from "../_components/commission-structures";

export const metadata = { title: "Commission Structures" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Commission Structures"
        description="What agents earn per rental — for making the reservation, opening, closing, or a walk-in — on each charge. Give agents a structure on Settings › Users."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Financial / Commission Settings" }, { label: "Commission Structures" }]}
      />
      <CommissionStructures />
    </>
  );
}
