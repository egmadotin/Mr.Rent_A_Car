import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { RateBatchUpdate } from "../_components/rate-batch-update";

export const metadata = { title: "Master Rate Batch Update" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Master Rate Batch Update"
        description="Change a rate code's prices for every vehicle type at once: by a percent, a flat amount, or to a set total."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Master Rate Batch Update" }]}
      />
      <RateBatchUpdate />
    </>
  );
}
