import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { EmailTemplates } from "../_components/email-templates";

export const metadata = { title: "Email Template" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Email Template"
        description="Saved marketing emails. Pick one under Email Template on Send Marketing Email to fill in the subject and message."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Email Marketing" }, { label: "Email Template" }]}
      />
      <EmailTemplates />
    </>
  );
}
