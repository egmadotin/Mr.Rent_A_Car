import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { SmsSettings } from "../_components/sms-settings";

export const metadata = { title: "SMS Notification" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="SMS Notification"
        description="Texts to staff on new reservations and the real-time dashboard, sent as email to the carrier's SMS gateway (needs Settings › Email Setup)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "SMS Notification" }]}
      />
      <SmsSettings />
    </>
  );
}
