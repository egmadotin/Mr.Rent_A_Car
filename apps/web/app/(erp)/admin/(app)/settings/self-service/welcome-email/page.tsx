import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { SelfServiceEmailSetup } from "../../_components/self-service-settings";

export const metadata = { title: "Self Service Welcome Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Self Service Welcome Email"
        description="Sent to a customer when they confirm their email after signing up on the website."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Self Service & Car Share SetUp" }, { label: "Self Service Welcome Email" }]}
      />
      <SelfServiceEmailSetup kind="welcome" />
    </>
  );
}
