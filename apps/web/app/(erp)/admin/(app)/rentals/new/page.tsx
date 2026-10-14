import { redirect } from "next/navigation";

/**
 * Walk-in "Start Rental" (legacy CheckOut3.aspx): capture renter + trip on the reservation form,
 * then the Start rental dialog opens straight away — one path for every rental, so charges,
 * duplicate checks and availability are identical whether or not there was a prior booking.
 */
export default async function NewRentalPage({ searchParams }: { searchParams: Promise<{ vehicleId?: string; customerId?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ start: "1" });
  if (sp.vehicleId) qs.set("vehicleId", sp.vehicleId);
  if (sp.customerId) qs.set("customerId", sp.customerId);
  redirect(`/admin/reservations/new?${qs}`);
}
