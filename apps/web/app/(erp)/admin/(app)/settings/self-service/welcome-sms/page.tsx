import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { SelfServiceWelcomeSms } from "../../_components/self-service-settings";

export const metadata = { title: "Welcome SMS" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Welcome SMS"
        description="The welcome text for self-service customers. Saved per location; website sign-ups get the emails (sign-up doesn't ask for a mobile carrier, so no text is sent)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Self Service & Car Share SetUp" }, { label: "Welcome SMS" }]}
      />
      <SelfServiceWelcomeSms />
    </>
  );
}
