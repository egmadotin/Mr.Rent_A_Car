import { PageHeader } from "../../../../_components/page-header";
import { NoAccess } from "../../../../_components/no-access";
import { can, workingLocationId } from "../../../../_lib/session";
import { QuoteForm } from "../_components/quote-form";

export const metadata = { title: "New quote" };

export default async function NewQuotePage() {
  if (!(await can("CheckAddQuote"))) return <NoAccess what="add quotes" />;
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader title="New quote" breadcrumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: "New" }]} />
      <QuoteForm defaultLocationId={locationId} />
    </>
  );
}
