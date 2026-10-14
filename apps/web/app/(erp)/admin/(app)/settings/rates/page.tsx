import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { requireStaff } from "../../../../_lib/session";
import { RatesList } from "./rates-list";

export const metadata = { title: "Master rates" };

export default async function Page() {
  const session = await requireStaff();
  const loc = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader title="Master rates" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rates" }, { label: "Master rates" }]} />
      <RatesList defaultLocationId={loc} />
    </>
  );
}
