import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { QuoteForm } from "../../_components/quote-form";
import { quoteToValues } from "../../_components/quote-values";

export const metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await (await api()).quote.byId({ quoteId: id }).catch(() => null);
  if (!data) notFound();
  const q = data.quote;
  const { values, options } = quoteToValues(q);
  return (
    <>
      <PageHeader
        title={`Edit quote #${q.number}`}
        breadcrumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: `#${q.number}`, href: `/admin/quotes/${q.id}` }, { label: "Edit" }]}
      />
      <QuoteForm
        initial={{
          quoteId: q.id,
          values,
          options,
          customerLabel: q.customer ? `${q.customer.firstName} ${q.customer.lastName}` : undefined,
        }}
      />
    </>
  );
}
