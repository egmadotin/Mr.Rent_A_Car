import { PageHeader } from "../../../../../_components/page-header";
import { requireStaff } from "../../../../../_lib/session";
import { ClaimV2Form } from "../../_components/claims-v2";

export const metadata = { title: "Claim" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const isNew = id === "new";
  return (
    <>
      <PageHeader
        title={isNew ? "Add Claim" : "Edit Claim"}
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Claims Management V2", href: "/admin/settings/claims-v2" }, { label: isNew ? "Add Claim" : "Edit Claim" }]}
      />
      <ClaimV2Form id={isNew ? undefined : id} />
    </>
  );
}
