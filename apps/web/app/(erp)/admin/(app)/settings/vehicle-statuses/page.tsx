import { Card } from "@mrac/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";

export const metadata = { title: "Status" };

/** Vehicle Setup > Status (StatusMain.aspx): RentCentric's 17 vehicle statuses. Built in here — the system relies on them (On Rent, Available …). */
const STATUSES = [
  "Accident Replacement", "Auction", "Available", "Comprehensive", "For Sale", "Grounded", "Has Problem", "Hold for Sale", "In Checkout Process",
  "In Repair", "In Service", "Leased Replacement", "On Rent", "Out of Service", "Sold", "Staff", "Stolen",
];

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Status"
        description="Vehicle statuses, as in RentCentric. They are fixed: rentals, availability and reports depend on them."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Vehicle Setup" }, { label: "Status" }]}
      />
      <div className="p-4 md:p-6">
        <Card className="max-w-md gap-0 py-0">
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{STATUSES.map((s) => <TableRow key={s}><TableCell>{s}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
