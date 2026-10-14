import { publicApi } from "../_lib/api";
import { BookingWidget } from "../_components/booking-widget";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact Us" };

export default async function ContactPage() {
  const locations = await (await publicApi()).locations();
  return (
    <>
      <section className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-4xl font-extrabold tracking-tight">Contact us</h1>
          <p className="mt-2 opacity-80">Questions about a booking, corporate accounts or insurance replacements — we’re here.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <ContactForm />
          <section>
            <h2 className="mb-4 text-xl font-bold">Locations</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {locations.map((l) => (
                <li key={l.id} className="rounded-lg border p-4 text-sm">
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-muted-foreground">{[l.address1, l.city].filter(Boolean).join(", ")}</div>
                  {l.phone && <a href={`tel:${l.phone}`} className="text-primary hover:underline">{l.phone}</a>}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="mb-3 text-lg font-semibold">Book a car</h2>
          <BookingWidget variant="panel" />
        </aside>
      </div>
    </>
  );
}
