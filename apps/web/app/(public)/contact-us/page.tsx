import { MailIcon, PhoneIcon } from "lucide-react";
import { publicApi } from "../_lib/api";
import { BookingWidget } from "../_components/booking-widget";
import { PageHero } from "../_components/ds";
import { PHONE } from "../_components/site-chrome";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact us" };

export default async function ContactPage() {
  const locations = await (await publicApi()).locations();
  return (
    <>
      <PageHero
        kicker="Contact"
        title="We’re here to help"
        lead="Questions about a booking, corporate accounts or insurance replacements — call, email or send us a message."
      >
        <div className="mt-7 flex flex-wrap gap-2">
          <a href={`tel:${PHONE.tel}`} className="inline-flex h-11 items-center gap-2 rounded-pill bg-foreground px-5 text-[15px] font-semibold text-background hover:bg-foreground/85">
            <PhoneIcon className="size-4" /> {PHONE.display}
          </a>
          <a href="mailto:info@mrrentacar.com" className="inline-flex h-11 items-center gap-2 rounded-pill border bg-card px-5 text-[15px] font-semibold hover:bg-muted">
            <MailIcon className="size-4" /> info@mrrentacar.com
          </a>
        </div>
      </PageHero>
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <ContactForm />
          <section className="space-y-4">
            <h2 className="type-title-3">Locations</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {locations.map((l) => (
                <li key={l.id} className="rounded-card border bg-card p-4 text-sm">
                  <div className="font-semibold">{l.name}</div>
                  <div className="text-muted-foreground">{[l.address1, l.city].filter(Boolean).join(", ")}</div>
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="mt-1 inline-block font-semibold underline-offset-4 hover:underline">
                      {l.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
          <h2 className="type-heading">Book a car</h2>
          <BookingWidget variant="panel" />
        </aside>
      </div>
    </>
  );
}
