import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { RentalsList } from "./rentals-list";

export const metadata = { title: "Rentals" };

export default async function RentalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const { status } = await searchParams;
  return (
    <>
      <PageHeader title="Rentals" description="Rental agreements across all locations." />
      <RentalsList initialStatus={status === "OPEN" || status === "CLOSED" || status === "VOIDED" ? status : undefined} />
    </>
  );
}
