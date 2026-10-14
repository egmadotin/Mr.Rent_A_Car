import { cookies } from "next/headers";
import { PageHeader } from "../../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../../_lib/cookies";
import { requireStaff } from "../../../../_lib/session";
import { QuoteForm } from "../_components/quote-form";

export const metadata = { title: "New quote" };

export default async function NewQuotePage() {
  const session = await requireStaff();
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader title="New quote" breadcrumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: "New" }]} />
      <QuoteForm defaultLocationId={locationId} />
    </>
  );
}
