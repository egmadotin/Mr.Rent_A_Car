import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { MakesModels } from "../_components/setup-settings";

export const metadata = { title: "Makes & Models" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Makes & Models" description="Vehicle makes and their models, offered on the vehicle form." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle Setup" }, { label: "Makes & Models" }]} />
      <MakesModels />
    </>
  );
}
