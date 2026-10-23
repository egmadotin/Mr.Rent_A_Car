import { publicApi } from "../_lib/api";
import { LocationCard } from "../_components/location-card";
import { Container, PageHero } from "../_components/ds";

export const metadata = { title: "Our locations" };

export default async function LocationsPage() {
  const locations = await (await publicApi()).locations();
  return (
    <>
      <PageHero
        kicker="Locations"
        title="Find a branch near you"
        lead="Real hours, addresses and phone numbers for every Mr. Rent A Car location in Metro Vancouver and Calgary."
      />
      <Container className="py-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((l) => (
            <LocationCard key={l.id} l={l} detailed />
          ))}
        </div>
      </Container>
    </>
  );
}
