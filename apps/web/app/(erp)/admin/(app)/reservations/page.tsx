import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { workingLocationId } from "../../../_lib/session";
import { ReservationsList } from "./reservations-list";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage() {
  // Advanced Search "Loc. Name" defaults to the working location, as in RentCentric
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader
        title="Reservations"
        actions={
          <Button asChild>
            <Link href="/admin/reservations/new"><PlusIcon /> New Reservation</Link>
          </Button>
        }
      />
      <ReservationsList defaultLocationId={locationId} />
    </>
  );
}
