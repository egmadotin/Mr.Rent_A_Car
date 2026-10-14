import { requireStaff } from "../../../../_lib/session";
import { RentalDetail } from "./_components/rental-detail";

export const metadata = { title: "Rental" };

export default async function RentalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  return <RentalDetail rentalId={id} />;
}
