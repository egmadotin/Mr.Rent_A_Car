import { PageHeader } from "../../../../_components/page-header";
import { workingLocationId } from "../../../../_lib/session";
import { QuoteForm } from "../_components/quote-form";

export const metadata = { title: "New quote" };

export default async function NewQuotePage() {
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader title="New quote" breadcrumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: "New" }]} />
      <QuoteForm defaultLocationId={locationId} />
    </>
  );
}
