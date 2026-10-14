import { PageHeader } from "../../../_components/page-header";
import { workingLocationId } from "../../../_lib/session";
import { FleetCalendar } from "./fleet-calendar";

export const metadata = { title: "Fleet calendar" };

export default async function CalendarPage() {
  const locationId = await workingLocationId();
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
