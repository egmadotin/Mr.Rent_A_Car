import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { WebsiteDesignSettings } from "../_components/website-settings";

export const metadata = { title: "Website Design V3" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Website Design V3"
        description="Style & Format: what RentCentric's Web Site Design held, with the header, footer, stylesheet, analytics and home page HTML applied to mrrentacar.com."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Website Design V3" }]}
      />
      <WebsiteDesignSettings />
    </>
  );
}
