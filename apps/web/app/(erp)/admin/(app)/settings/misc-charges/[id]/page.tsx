import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { ChargeForm } from "../../_components/charge-form";

export const metadata = { title: "Edit misc. charge" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await (await api()).settings.miscGet({ id }).catch(() => null);
  if (!item) notFound();
  // plain JSON for the client form (Decimal → string, Date → ISO)
  const initial = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
  return (
    <>
      <PageHeader title={item.name} description={item.code} breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Miscellaneous charges", href: "/admin/settings/misc-charges" }, { label: item.name }]} />
      <ChargeForm kind="misc" id={item.id} initial={initial} />
    </>
  );
}
