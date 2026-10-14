import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { CustomerForm } from "../../_components/customer-form";

export const metadata = { title: "Edit customer" };

const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await (await api()).customer.byId({ customerId: id }).catch(() => null);
  if (!data) notFound();
  const c = data.customer;
  const { memos: _m, creditCards: _cc, rentals: _r, reservations: _rs, attachments: _a, clubMembership: _cm, linkedDrivers: _l, primaryCustomer: _p, ...rest } = c;
  const initial: Record<string, string | boolean | null> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v instanceof Date) initial[k] = d(v);
    else if (typeof v === "string" || typeof v === "boolean" || v === null) initial[k] = v;
  }
  return (
    <>
      <PageHeader
        title={`Edit ${c.firstName} ${c.lastName}`}
        breadcrumbs={[{ label: "Customers", href: "/admin/customers" }, { label: `${c.firstName} ${c.lastName}`, href: `/admin/customers/${c.id}` }, { label: "Edit" }]}
      />
      <CustomerForm
        customerId={c.id}
        initial={initial}
        verifiedNote={c.identityVerified && c.identityVerifiedAt ? `Verified (${c.identityVerifiedMethod?.toLowerCase()}) on ${c.identityVerifiedAt.toISOString().slice(0, 10)}` : undefined}
      />
    </>
  );
}
