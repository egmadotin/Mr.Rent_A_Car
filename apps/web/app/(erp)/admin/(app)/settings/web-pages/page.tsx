import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { WebPagesSettings } from "../_components/website-settings";

export const metadata = { title: "Add/Edit Webpages" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Add/Edit Webpages"
        description="Links and pages listed on the website footer."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Add/Edit Webpages" }]}
      />
      <WebPagesSettings />
    </>
  );
}
