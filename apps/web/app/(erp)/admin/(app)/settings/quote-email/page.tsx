import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { QuoteEmailSettings } from "../_components/booking-email-settings";

export const metadata = { title: "Quote Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Quote Email"
        description="Sent by Email Quote: this subject and body, with the quote's details filled in."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Quote Email" }]}
      />
      <QuoteEmailSettings />
    </>
  );
}
