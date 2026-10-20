import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { ReferralSettings } from "../_components/referral-settings";

export const metadata = { title: "Referrals" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Referrals"
        description="Where customers heard of us (Source of Referral on bookings and customers; commissions can be paid to a referral)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Financial / Commission Settings" }, { label: "Referrals" }]}
      />
      <ReferralSettings />
    </>
  );
}
