import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { PosItems } from "../../_components/point-of-sale";

export const metadata = { title: "Merchandise Items" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Merchandise Items"
        description="Enter and manage merchandise items you sell to clients."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Point Of Sale" }, { label: "Merchandise Items" }]}
      />
      <PosItems />
    </>
  );
}
