import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { WidgetSettings } from "../_components/website-settings";

export const metadata = { title: "Widget/Rotator Setup" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Widget/Rotator Setup"
        description="A booking widget and a vehicle rotator to put on other websites."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Widget/Rotator Setup" }]}
      />
      <WidgetSettings />
    </>
  );
}
