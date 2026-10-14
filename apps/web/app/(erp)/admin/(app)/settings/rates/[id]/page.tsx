import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { RateForm } from "../rate-form";

export const metadata = { title: "Edit rate" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rate = await (await api()).settings.rateGet({ id }).catch(() => null);
  if (!rate) notFound();
  return (
    <>
      <PageHeader title={rate.code} breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Master rates", href: "/admin/settings/rates" }, { label: rate.code }]} />
      <RateForm id={rate.id} initial={JSON.parse(JSON.stringify(rate))} />
    </>
  );
}
