import Link from "next/link";
import { PlusCircleIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { NoAccess } from "../../../_components/no-access";
import { can, workingLocationId } from "../../../_lib/session";
import { RentalsList } from "./rentals-list";

export const metadata = { title: "Rent" };

/** AgreementsSearch.aspx: titled "Rent", with "Start Rental". `?status=` comes from the dashboard tiles. */
export default async function RentalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!(await can("Agreements"))) return <NoAccess what="see rentals" />;
  const locationId = await workingLocationId();
  const { status } = await searchParams;
  return (
    <>
      <PageHeader
        title="Rent"
        actions={(await can("CheckOuts")) ? <Button asChild><Link href="/admin/rentals/new"><PlusCircleIcon /> Start Rental</Link></Button> : undefined}
      />
      <RentalsList defaultLocationId={locationId} initialStatus={status === "OPEN" || status === "CLOSED" || status === "VOIDED" ? status : undefined} />
    </>
  );
}
