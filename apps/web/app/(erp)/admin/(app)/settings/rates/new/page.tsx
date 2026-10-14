import { cookies } from "next/headers";
import { PageHeader } from "../../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../../_lib/cookies";
import { requireStaff } from "../../../../../_lib/session";
import { RateForm } from "../rate-form";

export const metadata = { title: "New rate" };

export default async function Page() {
  const session = await requireStaff();
  const loc = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader title="New rate" breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Master rates", href: "/admin/settings/rates" }, { label: "New" }]} />
      <RateForm defaultLocationId={loc} />
    </>
  );
}
