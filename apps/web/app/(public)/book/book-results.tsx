"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CalendarIcon, MapPinIcon, PencilIcon } from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { BUSINESS_TZ, dateTime, fromDateTimeLocal, money } from "@mrac/ui/lib/format";
import { BookingWidget, toQuery, type BookingSearch } from "../_components/booking-widget";
import { VehicleClassCard } from "../_components/vehicle-class-card";
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <BookingSteps current={1} />

      {/* Booking summary bar (legacy "Change booking info") */}
      <section aria-label="Your search" className="rounded-xl border bg-card p-4">
        {editing || !valid ? (
          <BookingWidget variant="compact" initial={search} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div className="flex items-start gap-2"><MapPinIcon className="mt-0.5 size-4 text-primary" /><div><div className="font-semibold">{name(search.pickup)}</div><div className="text-muted-foreground">{dateTime(fromDateTimeLocal(search.from, tz), tz)}</div></div></div>
            <ArrowRightIcon className="hidden size-4 text-muted-foreground sm:block" />
            <div className="flex items-start gap-2"><MapPinIcon className="mt-0.5 size-4 text-primary" /><div><div className="font-semibold">{name(search.return ?? search.pickup)}</div><div className="text-muted-foreground">{dateTime(fromDateTimeLocal(search.to, tz), tz)}</div></div></div>
            {q.data?.[0] && <div className="flex items-center gap-2"><CalendarIcon className="size-4 text-primary" /> {q.data[0].days} day{q.data[0].days > 1 ? "s" : ""}</div>}
            {search.promo && <Badge variant="outline">Promo: {search.promo}</Badge>}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing(true)}><PencilIcon /> Change booking info</Button>
          </div>
        )}
      </section>

      {valid && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Select a vehicle</h1>
          <label className="flex items-center gap-2 text-sm">Sort
            <NativeSelect className="w-40" value={sort} onChange={(e) => setSort(e.target.value as "price" | "name")}>
              <option value="price">Lowest price</option>
              <option value="name">Alphabetic</option>
            </NativeSelect>
          </label>
        </div>
      )}

      {q.isLoading && <p className="text-muted-foreground">Finding available cars…</p>}
      {q.error && <p role="alert" className="text-destructive">{q.error.message}</p>}
      {q.data?.length === 0 && <p className="text-muted-foreground">No cars available online for these dates. Try other dates or call us.</p>}

      <div className="grid gap-4">
        {results.map((r) => (
          <VehicleClassCard key={r.vehicleType.id} vc={r.vehicleType}>
            <div className="text-right">
              {/* headline = rental charge, as on mrrentacar.com; fees and taxes are added at the next steps */}
              <div className="text-2xl font-extrabold tabular-nums">{money(r.price)}</div>
              <div className="text-xs text-muted-foreground">for {r.days} day{r.days > 1 ? "s" : ""} · est. {money(r.total)} with fees &amp; taxes</div>
              {r.kmIncluded != null && <div className="mt-1 text-xs text-muted-foreground">{r.kmIncluded.toLocaleString()} km included · additional at {money(r.extraKmCharge)}</div>}
            </div>
            {r.available ? (
              <Button asChild>
                <Link href={`/book/options?${toQuery(search)}&type=${r.vehicleType.id}`}>Reserve now <ArrowRightIcon /></Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>Sold out for these dates</Button>
            )}
          </VehicleClassCard>
        ))}
      </div>
    </div>
  );
}
