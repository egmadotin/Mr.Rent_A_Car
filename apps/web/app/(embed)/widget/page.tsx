import { headers } from "next/headers";
import { serverApi } from "@mrac/api/server";
import { WidgetForm } from "../_components/widget-form";

export const metadata = { title: "Book a car | Mr. Rent A Car" };

/** Settings > Widget/Rotator Setup: the online booking widget for other websites. */
export default async function WidgetPage() {
  const api = (await serverApi(await headers())).customer;
  const [locations, site] = await Promise.all([api.locations(), api.siteChrome()]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return <WidgetForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} bookUrl={`${origin}/book`} target={site.widgetTarget} />;
}
