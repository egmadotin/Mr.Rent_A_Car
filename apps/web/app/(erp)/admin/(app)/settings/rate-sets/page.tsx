import { PageHeader } from "../../../../_components/page-header";
import { requireStaff, workingLocationId } from "../../../../_lib/session";
import { RateSets } from "../_components/rate-sets";

export const metadata = { title: "Rate Sets" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Rate Sets"
        description="A season's rates as one set: every vehicle class × rental length (1–2, 3–5 … 26–30 days), one rate code per length."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Rate Sets" }]}
      />
      <RateSets defaultLocationId={await workingLocationId()} />
    </>
  );
}
