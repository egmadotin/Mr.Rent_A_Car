"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, ArrowRightIcon, BadgePercentIcon, CalendarIcon, InfoIcon, MapPinIcon, PencilIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { BUSINESS_TZ, dateTime, fromDateTimeLocal, money } from "@mrac/ui/lib/format";
import { BookingWidget, toQuery, type BookingSearch } from "../_components/booking-widget";
import { VehicleClassCard } from "../_components/vehicle-class-card";
import { Notice, Price } from "../_components/ds";
import { BookingSteps } from "./steps";

export function BookResults({ search }: { search: BookingSearch }) {
  const trpc = useTRPC();
  const locations = useQuery(trpc.customer.locations.queryOptions()).data;
  // search times are wall-clock time at the pickup location
  const tz = locations?.find((l) => l.id === search.pickup)?.timeZone ?? BUSINESS_TZ;
  const [editing, setEditing] = React.useState(false);
  const [sort, setSort] = React.useState<"price" | "name">("price");
  const valid = !!(search.pickup && search.from && search.to);
  const input = {
    pickupLocationId: search.pickup ?? "",
    returnLocationId: search.return ?? search.pickup ?? "",
    pickupAt: fromDateTimeLocal(search.from, tz),
    returnAt: fromDateTimeLocal(search.to, tz),
    promoCode: search.promo,
  };
  const q = useQuery({ ...trpc.customer.search.queryOptions(input), enabled: valid, retry: false });
  const name = (id?: string) => locations?.find((l) => l.id === id)?.name ?? "…";
  const results = [...(q.data ?? [])].sort((a, b) => (sort === "price" ? Number(a.price) - Number(b.price) : a.vehicleType.name.localeCompare(b.vehicleType.name)));

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-8">
      <BookingSteps current={1} />

      {/* Your search (legacy "Change booking info") */}
      <section aria-label="Your search">
        {editing || !valid ? (
          <BookingWidget variant="compact" initial={search} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-card border bg-card p-4 text-sm sm:p-5">
            <Leg label="Pick-up" place={name(search.pickup)} when={dateTime(fromDateTimeLocal(search.from, tz), tz)} />
            <ArrowRightIcon className="hidden size-4 text-muted-foreground sm:block" />
            <Leg label="Return" place={name(search.return ?? search.pickup)} when={dateTime(fromDateTimeLocal(search.to, tz), tz)} />
            {q.data?.[0] && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 font-semibold">
                <CalendarIcon className="size-4" /> {q.data[0].days} day{q.data[0].days > 1 ? "s" : ""}
              </span>
            )}
            {search.promo && <Badge variant="outline">Promo {search.promo}</Badge>}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
              <PencilIcon /> Change
            </Button>
          </div>
        )}
      </section>

      {valid && (
        <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
          <div>
            <h1 className="type-title-2">Choose your car</h1>
            {q.data && <p className="mt-1 text-sm text-muted-foreground">{q.data.length} classes for your dates · prices include the rental charge; the total adds fees and taxes.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            Sort
            <NativeSelect className="w-44" value={sort} onChange={(e) => setSort(e.target.value as "price" | "name")}>
              <option value="price">Lowest price</option>
              <option value="name">Alphabetical</option>
            </NativeSelect>
          </label>
        </div>
      )}

      {q.isLoading && (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-card border bg-card" />
          ))}
        </div>
      )}
      {q.error && <Notice tone="danger" icon={AlertCircleIcon}>{q.error.message}</Notice>}
      {q.data?.length === 0 && <Notice tone="muted" icon={InfoIcon}>No cars are available online for these dates. Try other dates or call us.</Notice>}
      {search.promo && q.data?.length ? (
        q.data.some((r) => r.promo?.ok) ? (
          <Notice tone="success" icon={BadgePercentIcon}>
            Promo code <strong>{search.promo}</strong> applied to the prices below{q.data.some((r) => !r.promo?.ok) ? " (where it applies)" : ""}.
          </Notice>
        ) : (
          <Notice tone="danger" icon={AlertCircleIcon}>{q.data[0]?.promo?.message}</Notice>
        )
      ) : null}

      <div className="grid gap-4">
        {results.map((r) => (
          <VehicleClassCard key={r.vehicleType.id} vc={r.vehicleType}>
            <div className="md:text-right">
              <Price amount={(Number(r.price) / Math.max(1, r.days)).toFixed(2)} />
              <p className="mt-1 text-sm">
                <span className="font-semibold tabular-nums">{money(r.total)}</span> <span className="text-muted-foreground">est. total for {r.days} day{r.days > 1 ? "s" : ""}, taxes and fees included</span>
              </p>
              {r.kmIncluded != null && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.kmIncluded.toLocaleString()} km included · then {money(r.extraKmCharge)}/km
                </p>
              )}
            </div>
            {r.available ? (
              <Button asChild size="lg" className="w-full md:w-auto">
                <Link href={`/book/options?${toQuery(search)}&type=${r.vehicleType.id}`}>
                  Reserve <ArrowRightIcon />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg" disabled className="w-full md:w-auto">
                Sold out for these dates
              </Button>
            )}
          </VehicleClassCard>
        ))}
      </div>
    </div>
  );
}

function Leg({ label, place, when }: { label: string; place: string; when: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <MapPinIcon className="mt-0.5 size-4 text-muted-foreground" />
      <div>
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <div className="font-semibold">{place}</div>
        <div className="text-muted-foreground">{when}</div>
      </div>
    </div>
  );
}
