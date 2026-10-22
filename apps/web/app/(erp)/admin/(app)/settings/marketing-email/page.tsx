import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { MarketingEmail } from "../_components/marketing-email";

export const metadata = { title: "Send Marketing Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Send Marketing Email"
        description="Email a group of customers. Customers who unsubscribed (or have no email) are left out; each email can carry its own unsubscribe link."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Email Marketing" }, { label: "Send Marketing Email" }]}
      />
      <MarketingEmail />
    </>
  );
}
