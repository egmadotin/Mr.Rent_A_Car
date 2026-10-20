import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { InspectionEmailSettings } from "../_components/inspection-email-settings";

export const metadata = { title: "Inspection Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Inspection Email"
        description="Sent from an inspection's email button: this text, then the inspection's details, with its photos attached."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Inspection Email" }]}
      />
      <InspectionEmailSettings />
    </>
  );
}
