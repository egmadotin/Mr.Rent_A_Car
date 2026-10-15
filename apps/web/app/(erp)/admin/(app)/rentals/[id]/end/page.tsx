import { requireStaff } from "../../../../../_lib/session";
import { EndRentalForm } from "./end-rental-form";

export const metadata = { title: "End Rental" };

/** End Rental = RentCentric CheckIn2.aspx?CustomerID=…&AgreementID=… */
export default async function EndRentalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  return <EndRentalForm rentalId={id} />;
}
