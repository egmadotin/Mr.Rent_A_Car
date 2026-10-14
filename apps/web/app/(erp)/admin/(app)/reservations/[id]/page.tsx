import { requireStaff } from "../../../../_lib/session";
import { ReservationDetail } from "./_components/reservation-detail";

export const metadata = { title: "Reservation" };

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const { start } = await searchParams;
  return <ReservationDetail reservationId={id} autoStartRental={start === "1"} />;
}
