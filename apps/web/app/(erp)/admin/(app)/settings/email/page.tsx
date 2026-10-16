import { redirect } from "next/navigation";
import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { EmailSettingsForm } from "./email-settings-form";

export const metadata = { title: "Email Setup" };

export default async function Page() {
  const session = await requireStaff();
  if ((session.user as { role?: string | null }).role !== "admin") redirect("/admin/settings");
  return (
    <>
      <PageHeader
        title="Email Setup"
        description="The mailbox emails are sent from: agreements, invoices, reservation confirmations and quotes."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Email Setup" }]}
      />
      <EmailSettingsForm adminEmail={session.user.email} />
    </>
  );
}
