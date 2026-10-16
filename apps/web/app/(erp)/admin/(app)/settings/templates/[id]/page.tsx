import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api, requireStaff } from "../../../../../_lib/session";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Edit template" };

/** AgreementFormsModify.aspx: name, type, default / active / auto-print / email-friendly, the HTML and its placeholders. */
export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const isAdmin = (session.user as { role?: string | null }).role === "admin";
  const { id } = await params;
  const staff = await api();
  const t = id === "new" ? null : await staff.template.byId({ id }).catch(() => null);
  if (id !== "new" && !t) notFound();
  const locations = (await staff.settings.lookups()).locations;
  return (
    <>
      <PageHeader
        title={t ? t.name : "New template"}
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rentals & Invoices", href: "/admin/settings/templates" }, { label: t ? t.name : "New" }]}
      />
      <TemplateEditor
        canEdit={isAdmin}
        initial={
          t
            ? { id: t.id, name: t.name, kind: t.kind, locationId: t.locationId, html: t.html, isActive: t.isActive, isDefault: t.isDefault, autoPrint: t.autoPrint, emailFriendly: t.emailFriendly }
            : { name: "", kind: "AGREEMENT", locationId: null, html: "", isActive: true, isDefault: false, autoPrint: false, emailFriendly: false }
        }
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </>
  );
}
