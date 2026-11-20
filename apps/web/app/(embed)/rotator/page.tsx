import { headers } from "next/headers";
import { serverApi } from "@mrac/api/server";
import { resolveVehicleImage } from "../../(public)/_lib/vehicle-images";
import { Rotator } from "../_components/rotator";

export const metadata = { title: "Our vehicles | Mr. Rent A Car" };

/** Settings > Widget/Rotator Setup: the vehicle rotator for other websites. */
export default async function RotatorPage() {
  const api = (await serverApi(await headers())).customer;
  const [classes, site] = await Promise.all([api.fleet({}), api.siteChrome()]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const slides = classes.map((c) => ({
    id: c.id, name: c.name, description: c.description, seats: c.seats,
    image: (() => { const src = resolveVehicleImage(c.name, c.imageKey); return src.startsWith("/") ? `${origin}${src}` : src; })(),
    from: "fromDaily" in c && c.fromDaily ? String(c.fromDaily) : null,
  }));
  return <Rotator slides={slides} href={`${origin}/fleet`} target={site.rotatorTarget} />;
}
