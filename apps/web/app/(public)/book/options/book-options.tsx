"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, InfoIcon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { BUSINESS_TZ, dateTime, fromDateTimeLocal, money } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { toQuery, type BookingSearch } from "../../_components/booking-widget";
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BookingSteps current={2} />
      <Button variant="ghost" size="sm" asChild className="px-0">
        <Link href={`/book?${toQuery(search)}`}><ArrowLeftIcon /> Back to vehicles</Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <h1 className="text-2xl font-bold">Rental options</h1>
          {opts.isLoading && <p className="text-muted-foreground">Loading options…</p>}
          {opts.error && <p role="alert" className="text-destructive">{opts.error.message}</p>}

          {opts.data && opts.data.protections.length > 0 && (
            <section aria-labelledby="prot-h" className="space-y-3">
              <h2 id="prot-h" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheckIcon className="size-5 text-primary" /> Protections & coverages</h2>
              <div role="radiogroup" aria-labelledby="prot-h" className="grid gap-2">
                {opts.data.protections.map((p) => {
                  const on = insuranceId === p.id;
                  return (
                    <label
                      key={p.id}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/60", on && "border-primary ring-1 ring-primary")}
                    >
                      <input type="radio" name="protection" className="accent-primary" checked={on} onChange={() => setInsuranceId(p.id)} />
                      <span className="flex-1">
                        <span className="font-medium">{p.name}</span>
                        {p.deductible && Number(p.deductible) > 0 && <span className="ml-2 text-xs text-muted-foreground">{money(p.deductible)} deductible</span>}
                        {p.description && (
                          <button
                            type="button"
                            className="ml-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              setDetails({ title: p.name, body: p.description! });
                            }}
                          >
                            Details
                          </button>
                        )}
                      </span>
                      <span className="font-semibold tabular-nums">{money(p.total)}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {opts.data && opts.data.extras.length > 0 && (
            <section aria-labelledby="extra-h" className="space-y-3">
              <h2 id="extra-h" className="text-lg font-semibold">Extra options</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {opts.data.extras.map((x) => {
                  const qty = x.included ? 1 : extras[x.id] ?? 0;
                  return (
                    <div key={x.id} className={cn("flex items-center gap-3 rounded-lg border bg-card p-4", qty > 0 && !x.included && "border-primary")}>
                      {x.included ? (
                        <span className="grid size-4 place-items-center rounded-sm bg-muted text-muted-foreground" title="Included with every rental"><LockIcon className="size-3" /></span>
                      ) : (
                        <input
                          id={`x-${x.id}`}
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={qty > 0}
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
                      )}
                      <label htmlFor={`x-${x.id}`} className="flex-1 text-sm">
                        <span className="font-medium">{x.name}</span>
                        {x.included && <Badge variant="muted" className="ml-2">Included</Badge>}
                        {x.description && (
                          <button type="button" className="ml-2 text-xs font-medium text-primary hover:underline" onClick={() => setDetails({ title: x.name, body: x.description! })}>
                            Details
                          </button>
                        )}
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
                      <span className="text-sm font-semibold tabular-nums">{x.percent ? `${Number(x.percent)}%` : money(x.total)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-3 rounded-xl border bg-card p-5 lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-semibold">Your booking</h2>
          <div className="text-lg font-bold">{vt?.name ?? "…"}</div>
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-muted-foreground">Pick-up: </dt><dd className="inline">{locName(search.pickup)}, {dateTime(fromDateTimeLocal(search.from, tz), tz)}</dd></div>
            <div><dt className="inline text-muted-foreground">Return: </dt><dd className="inline">{locName(search.return ?? search.pickup)}, {dateTime(fromDateTimeLocal(search.to, tz), tz)}</dd></div>
          </dl>
          {quote.data && (
            <>
              <table className="w-full text-sm">
                <tbody>
                  {quote.data.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-0.5 text-muted-foreground">{l.kind === "TIME" ? "Rental charges" : l.name}</td>
                      <td className="py-0.5 text-right tabular-nums">{money(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{money(quote.data.total)}</span></div>
            </>
          )}
          <Button className="w-full" size="lg" onClick={next} disabled={!opts.data}>
            Continue <ArrowRightIcon />
          </Button>
        </aside>
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
    </div>
  );
}
