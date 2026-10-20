import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { SignatureSettings } from "../_components/signature-settings";

export const metadata = { title: "Signature And Initials" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Signature And Initials"
        description="Disclaimers with a signature or initials line, printed on contracts when a misc charge / insurance is (or is not) on the booking."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rental Contracts & Invoices" }, { label: "Signature And Initials" }]}
      />
      <SignatureSettings />
    </>
  );
}
