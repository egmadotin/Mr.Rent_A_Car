"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CheckIcon, InfoIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { BUSINESS_TZ, fromDateTimeLocal, money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { toQuery, type BookingSearch } from "../../_components/booking-widget";
import { BookingBanner, BookingSummary, legacyStamp } from "../booking-summary";
import { BookingSteps } from "../steps";

/** Encodes chosen extras for the URL: "id:qty,id:qty". */
export const encodeExtras = (m: Record<string, number>) =>
  Object.entries(m)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${id}:${q}`)
    .join(",");
export const decodeExtras = (s?: string) =>
  Object.fromEntries((s ?? "").split(",").filter(Boolean).map((p) => {
    const [id, q] = p.split(":");
    return [id!, Math.max(0, Number(q) || 1)];
  }));

/** Same structure as mrrentacar.com's Rental Options step: pick one protection, add extras. */
export function BookOptions({ search, vehicleTypeId }: { search: BookingSearch; vehicleTypeId: string }) {
  const trpc = useTRPC();
  const locations = useQuery(trpc.customer.locations.queryOptions()).data;
  // search times are wall-clock time at the pickup location
  const tz = locations?.find((l) => l.id === search.pickup)?.timeZone ?? BUSINESS_TZ;
  const router = useRouter();
  const base = {
    pickupLocationId: search.pickup ?? "",
    returnLocationId: search.return ?? search.pickup ?? "",
    pickupAt: fromDateTimeLocal(search.from, tz),
    returnAt: fromDateTimeLocal(search.to, tz),
    promoCode: search.promo,
  };
  const opts = useQuery({ ...trpc.customer.options.queryOptions({ ...base, vehicleTypeId }), retry: false });
  const types = useQuery(trpc.customer.fleet.queryOptions({})).data;
  const vt = types?.find((t) => t.id === vehicleTypeId);

  const [insuranceId, setInsuranceId] = React.useState<string | null>(null);
  const [extras, setExtras] = React.useState<Record<string, number>>({});
  const [details, setDetails] = React.useState<{ title: string; body: string } | null>(null);

  // default protection = "Default Insurance" (e.g. No Protection), as on the live site
  React.useEffect(() => {
    if (opts.data && insuranceId === null) setInsuranceId(opts.data.protections.find((p) => p.isDefault)?.id ?? opts.data.protections[0]?.id ?? null);
  }, [opts.data, insuranceId]);

  const chosen = Object.entries(extras).filter(([, q]) => q > 0).map(([miscChargeId, quantity]) => ({ miscChargeId, quantity }));
  const quote = useQuery({
    ...trpc.customer.quote.queryOptions({ ...base, vehicleTypeId, insuranceId, miscCharges: chosen }),
    enabled: !!opts.data,
    placeholderData: (p) => p,
  });
  const locName = (id?: string) => locations?.find((l) => l.id === id)?.name ?? "…";

  function next() {
    const q = new URLSearchParams(toQuery(search));
    q.set("type", vehicleTypeId);
    if (insuranceId) q.set("ins", insuranceId);
    const x = encodeExtras(extras);
    if (x) q.set("x", x);
    router.push(`/book/details?${q}`);
  }

  const rentalCharges = (quote.data?.lines ?? []).filter((l) => l.kind === "TIME").reduce((a, l) => a + Number(l.total), 0);
  const when = (v?: string) => (v ? legacyStamp(fromDateTimeLocal(v, tz), tz) : "");
  const detailsLink = (title: string, body: string | null) =>
    body ? (
      <button type="button" className="ml-1 font-semibold italic hover:underline" onClick={(e) => { e.preventDefault(); setDetails({ title, body }); }}>
        (Details)
      </button>
    ) : null;

  return (
    <>
      <BookingBanner title="Rental Options" />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <BookingSteps current={2} hrefs={[`/book?${toQuery(search)}`]} />
        <BookingSummary
          pickup={{ location: locName(search.pickup), when: when(search.from) }}
          dropoff={{ location: locName(search.return ?? search.pickup), when: when(search.to) }}
          vehicle={vt}
          lines={quote.data?.lines}
          total={quote.data?.total}
          promo={quote.data?.promo}
        />
        {opts.isLoading && <p className="text-muted-foreground">Loading options…</p>}
        {opts.error && <p role="alert" className="text-destructive">{opts.error.message}</p>}

        {opts.data && opts.data.protections.length > 0 && (
          <section aria-labelledby="prot-h" className="space-y-3 border-t pt-8">
            <h2 id="prot-h" className="text-xl">Protections &amp; Coverages</h2>
            <div role="radiogroup" aria-labelledby="prot-h" className="grid gap-3">
              {opts.data.protections.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-sm bg-muted px-3 py-2.5 text-sm">
                  <OptionIcon src={p.image} />
                  <input type="radio" name="protection" className="accent-primary" checked={insuranceId === p.id} onChange={() => setInsuranceId(p.id)} />
                  <span className="flex-1 uppercase text-muted-foreground">
                    {p.name}
                    {detailsLink(p.name, p.description)}
                  </span>
                  <span className="pr-4 tabular-nums text-muted-foreground">{money(p.total)}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {opts.data && opts.data.extras.length > 0 && (
          <section aria-labelledby="extra-h" className="space-y-3">
            <h2 id="extra-h" className="text-xl">Choose Extra Options</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {opts.data.extras.map((x) => {
                const qty = x.included ? 1 : extras[x.id] ?? 0;
                const price = x.percent ? (rentalCharges * Number(x.percent)) / 100 : Number(x.total);
                return (
                  <div key={x.id} className="flex items-center gap-3 rounded-sm bg-muted px-3 py-2.5 text-sm">
                    <OptionIcon src={x.image} />
                    <input
                      id={`x-${x.id}`}
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={qty > 0}
                      disabled={x.included}
                      title={x.included ? "Included with every rental" : undefined}
                      onChange={(e) =>
                        setExtras((s) => {
                          const n = { ...s, [x.id]: e.target.checked ? 1 : 0 };
                          // one charge per group (e.g. a single snow-tire option)
                          if (e.target.checked && x.group)
                            for (const o of opts.data!.extras) if (o.group === x.group && o.id !== x.id) n[o.id] = 0;
                          return n;
                        })
                      }
                    />
                    <label htmlFor={`x-${x.id}`} className="flex-1 uppercase text-muted-foreground">
                      {x.name}
                      {detailsLink(x.name, x.description)}
                    </label>
                    {x.multiSelect && qty > 0 && (
                      <select
                        aria-label={`${x.name} quantity`}
                        className="h-8 rounded-md border bg-background px-1 text-sm"
                        value={qty}
                        onChange={(e) => setExtras((s) => ({ ...s, [x.id]: Number(e.target.value) }))}
                      >
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    )}
                    <span className="tabular-nums text-muted-foreground">{money(price)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="flex justify-end">
          <Button size="lg" onClick={next} disabled={!opts.data}>Continue <ArrowRightIcon /></Button>
        </div>
      </div>

      <Dialog open={details !== null} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{details?.title}</DialogTitle></DialogHeader>
          <ul className="space-y-1.5 text-sm">
            {details?.body.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line, i) => {
              const yes = line.startsWith("✅");
              const no = line.startsWith("❌");
              const text = line.replace(/^(✅|❌)\s*/, "");
              return (
                <li key={i} className={cn("flex items-start gap-2", !yes && !no && i === 0 && "font-semibold")}>
                  {yes && <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />}
                  {no && <span className="mt-0.5 shrink-0 text-destructive">✕</span>}
                  {!yes && !no && i > 0 && <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The option's picture from RentCentric's image folder (as on the live site). */
function OptionIcon({ src }: { src?: string | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- RentCentric-hosted icons, same as the live site
  return <span className="grid size-9 shrink-0 place-items-center">{src ? <img src={src} alt="" className="max-h-9 max-w-9 object-contain" /> : null}</span>;
}

