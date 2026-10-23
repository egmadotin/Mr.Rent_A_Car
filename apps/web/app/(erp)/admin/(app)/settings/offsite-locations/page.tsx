import { PageHeader } from "../../../../_components/page-header";
import { requireStaff, workingLocationId } from "../../../../_lib/session";
import { OffsiteSettings } from "../_components/offsite-settings";

export const metadata = { title: "Offsite Locations" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Offsite Locations"
        description="Extra pick-up / return points that belong to a location (e.g. an airport or hotel lot)."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Location Information" }, { label: "Offsite Locations" }]}
      />
      <OffsiteSettings defaultLocationId={await workingLocationId()} />
    </>
  );
}
