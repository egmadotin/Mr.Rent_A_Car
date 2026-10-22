import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ReservationEmailSettings } from "../_components/booking-email-settings";

export const metadata = { title: "Reservation Email" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Reservation Email"
        description="The email a customer gets for an online booking (and Send Confirmation Email), with a copy to staff."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Website & Email Setup" }, { label: "Reservation Email" }]}
      />
      <ReservationEmailSettings />
    </>
  );
}
