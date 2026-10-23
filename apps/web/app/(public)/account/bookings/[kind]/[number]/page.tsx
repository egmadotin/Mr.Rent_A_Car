import { notFound } from "next/navigation";
import { BookingDetail } from "../../../account-forms";

export const metadata = { title: "Booking" };

export default async function Page({ params }: { params: Promise<{ kind: string; number: string }> }) {
  const { kind, number } = await params;
  if ((kind !== "reservation" && kind !== "rental") || !/^\d+$/.test(number)) notFound();
  return <BookingDetail kind={kind} number={Number(number)} />;
}
