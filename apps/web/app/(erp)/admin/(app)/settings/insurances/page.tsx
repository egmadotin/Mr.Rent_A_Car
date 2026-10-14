import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { requireStaff } from "../../../../_lib/session";
import { ChargeList } from "../_components/charge-list";

export const metadata = { title: "Insurance coverage" };

export default async function Page() {
  const session = await requireStaff();
  const loc = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader title="Insurance coverage" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Insurance coverage" }]} />
      <ChargeList kind="insurance" defaultLocationId={loc} />
    </>
  );
}
