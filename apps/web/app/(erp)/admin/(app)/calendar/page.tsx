import { cookies } from "next/headers";
import { PageHeader } from "../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../_lib/cookies";
import { requireStaff } from "../../../_lib/session";
import { FleetCalendar } from "./fleet-calendar";

export const metadata = { title: "Fleet calendar" };

export default async function CalendarPage() {
  const session = await requireStaff();
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader
        title="Fleet calendar"
        description="Every vehicle's reservations and rentals on one timeline. Drag a reservation onto a vehicle of the same type to assign it."
      />
      <FleetCalendar defaultLocationId={locationId} />
    </>
  );
}
