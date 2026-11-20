import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { SelfServiceEmailSetup } from "../../_components/self-service-settings";

export const metadata = { title: "Self Service Registration Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Self Service Registration Email"
        description="Sent to a customer right after they sign up on the website."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Self Service & Car Share SetUp" }, { label: "Self Service Registration Email" }]}
      />
      <SelfServiceEmailSetup kind="registration" />
    </>
  );
}
