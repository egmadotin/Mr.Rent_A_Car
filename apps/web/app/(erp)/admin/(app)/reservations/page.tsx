import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { ReservationsList } from "./reservations-list";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        title="Reservations"
        actions={
          <Button asChild>
            <Link href="/admin/reservations/new"><PlusIcon /> New reservation</Link>
          </Button>
        }
      />
      <ReservationsList />
    </>
  );
}
