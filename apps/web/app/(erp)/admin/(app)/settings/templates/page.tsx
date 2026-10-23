import Link from "next/link";
import { PlusCircleIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { PageHeader } from "../../../../_components/page-header";
import { api, requireStaff } from "../../../../_lib/session";
import { LinkRow } from "../../../../_components/link-row";

export const metadata = { title: "Rentals & Invoices" };

/** AgreementFormsMain.aspx: Rental Name, Rental Type, Default, Active — click a row to edit (admins). */
export default async function TemplatesPage() {
  const session = await requireStaff();
  const isAdmin = (session.user as { role?: string | null }).role === "admin";
  const rows = await (await api()).template.list({});
  return (
    <>
      <PageHeader
        title="Rentals & Invoices"
        description="Printable templates. Placeholders like ##7## (RA number) are filled from the rental or reservation when printing."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Rental Contracts & Invoices" }, { label: "Rentals & Invoices" }]}
        actions={isAdmin ? <Button asChild><Link href="/admin/settings/templates/new"><PlusCircleIcon /> New template</Link></Button> : undefined}
      />
      <div className="p-4 md:p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rental Name</TableHead>
                <TableHead>Rental Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <LinkRow key={t.id} href={`/admin/settings/templates/${t.id}`}>
                  <TableCell>
                    <Link href={`/admin/settings/templates/${t.id}`} className="font-medium text-primary hover:underline">{t.name}</Link>
                  </TableCell>
                  <TableCell>{t.kind === "AGREEMENT" ? "Agreement" : t.kind === "RESERVATION" ? "Reservation" : "Quote"}</TableCell>
                  <TableCell>{t.location?.name ?? "All locations"}</TableCell>
                  <TableCell>{t.isDefault ? <Badge variant="success">Yes</Badge> : "No"}</TableCell>
                  <TableCell>{t.isActive ? "Yes" : <span className="text-muted-foreground">No</span>}</TableCell>
                </LinkRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No templates yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
