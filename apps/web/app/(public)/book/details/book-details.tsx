"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { Textarea } from "@mrac/ui/components/textarea";
import { BUSINESS_TZ, dateTime, fromDateTimeLocal, money } from "@mrac/ui/lib/format";
import { toQuery, type BookingSearch } from "../../_components/booking-widget";
import { BookingSteps } from "../steps";
import { decodeExtras } from "../options/book-options";

type Errors = Record<string, string[] | undefined>;

/** Fields from the current site's reserve form: name, phone, age, email, notes. No online payment. */
export function BookDetails({ search, vehicleTypeId, insuranceId, extras }: { search: BookingSearch; vehicleTypeId: string; insuranceId?: string; extras?: string }) {
  const trpc = useTRPC();
  const locations = useQuery(trpc.customer.locations.queryOptions()).data;
  // search times are wall-clock time at the pickup location
  const tz = locations?.find((l) => l.id === search.pickup)?.timeZone ?? BUSINESS_TZ;
  const client = useTRPCClient();
  const router = useRouter();
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const searchInput = {
    pickupLocationId: search.pickup ?? "",
    returnLocationId: search.return ?? search.pickup ?? "",
    pickupAt: fromDateTimeLocal(search.from, tz),
    returnAt: fromDateTimeLocal(search.to, tz),
    promoCode: search.promo,
  };
  const miscCharges = Object.entries(decodeExtras(extras)).map(([miscChargeId, quantity]) => ({ miscChargeId, quantity }));
  const [age, setAge] = React.useState<number | null>(null);
  const results = useQuery({ ...trpc.customer.search.queryOptions(searchInput), retry: false });
  const quote = useQuery({
    ...trpc.customer.quote.queryOptions({ ...searchInput, vehicleTypeId, insuranceId: insuranceId ?? null, miscCharges, driverAge: age }),
    placeholderData: (p) => p,
  });
  const choice = results.data?.find((r) => r.vehicleType.id === vehicleTypeId);
  const locName = (id?: string) => locations?.find((l) => l.id === id)?.name ?? "…";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await client.customer.requestReservation.mutate({
        search: searchInput,
        vehicleTypeId,
        insuranceId: insuranceId ?? null,
        miscCharges,
        firstName: String(f.get("firstName") ?? ""),
        lastName: String(f.get("lastName") ?? ""),
        email: String(f.get("email") ?? ""),
        phone: String(f.get("phone") ?? ""),
        age: f.get("age") as unknown as number,
        notes: String(f.get("notes") ?? "") || undefined,
        website: String(f.get("website") ?? "") || undefined,
      });
      router.push(`/book/confirmed?n=${res.reservationNumber}&total=${res.total}`);
    } catch (err) {
      const fe = (err as { data?: { zodError?: { fieldErrors?: Errors } } })?.data?.zodError?.fieldErrors ?? {};
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Please check the highlighted fields." : (err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];
  const F = (p: { id: string; label: string; children: React.ReactNode; className?: string }) => (
    <div className={`space-y-1.5 ${p.className ?? ""}`}>
      <Label htmlFor={p.id}>{p.label}</Label>
      {p.children}
      {err(p.id) && <p className="text-xs text-destructive">{err(p.id)}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <BookingSteps current={3} />
      <Button variant="ghost" size="sm" asChild className="px-0"><Link href={`/book/options?${toQuery(search)}&type=${vehicleTypeId}`}><ArrowLeftIcon /> Back to options</Link></Button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form onSubmit={submit} noValidate className="space-y-5">
          <h1 className="text-2xl font-bold">Your details</h1>
          {formError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {F({ id: "firstName", label: "First name", children: <Input id="firstName" name="firstName" autoComplete="given-name" aria-invalid={!!err("firstName")} required /> })}
            {F({ id: "lastName", label: "Last name", children: <Input id="lastName" name="lastName" autoComplete="family-name" aria-invalid={!!err("lastName")} required /> })}
            {F({ id: "email", label: "Email", children: <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!err("email")} required /> })}
            {F({ id: "phone", label: "Phone", children: <Input id="phone" name="phone" type="tel" autoComplete="tel" aria-invalid={!!err("phone")} required /> })}
            {F({ id: "age", label: "Driver's age", children: <Input id="age" name="age" type="number" min={16} max={120} inputMode="numeric" aria-invalid={!!err("age")} required onBlur={(e) => { const n = Number(e.target.value); setAge(n >= 16 && n <= 120 ? n : null); }} /> })}
            {F({ id: "notes", label: "Notes (optional)", className: "sm:col-span-2", children: <Textarea id="notes" name="notes" rows={3} placeholder="Flight number, child seat, anything we should know" /> })}
            {/* honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            We’ll confirm your reservation by phone or email. No payment is taken online — you’ll pay at pick-up. Drivers under 25 may have an additional fee.
          </p>
          <Button type="submit" size="lg" disabled={pending || !choice?.available}>
            {pending && <Loader2Icon className="animate-spin" />} Request reservation
          </Button>
        </form>

        <aside className="space-y-3 rounded-xl border bg-card p-5 lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-semibold">Your booking</h2>
          {!choice ? (
            <p className="text-sm text-muted-foreground">{results.isLoading ? "Loading…" : "This class isn't available for these dates."}</p>
          ) : (
            <>
              <div className="text-lg font-bold">{choice.vehicleType.name}</div>
              {choice.vehicleType.description && <p className="text-sm text-muted-foreground">{choice.vehicleType.description}</p>}
              <dl className="space-y-1 text-sm">
                <div><dt className="inline text-muted-foreground">Pick-up: </dt><dd className="inline">{locName(search.pickup)}, {dateTime(fromDateTimeLocal(search.from, tz), tz)}</dd></div>
                <div><dt className="inline text-muted-foreground">Return: </dt><dd className="inline">{locName(search.return ?? search.pickup)}, {dateTime(fromDateTimeLocal(search.to, tz), tz)}</dd></div>
              </dl>
              <table className="w-full text-sm">
                <tbody>
                  {(quote.data?.lines ?? []).map((l, i) => (
                    <tr key={i}><td className="py-0.5 text-muted-foreground">{l.kind === "TIME" ? "Rental charges" : l.name}</td><td className="py-0.5 text-right tabular-nums">{money(l.total)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between border-t pt-2 font-bold"><span>Estimated total</span><span className="tabular-nums">{money(quote.data?.total ?? choice.total)}</span></div>
              {age !== null && age < 25 && <p className="text-xs text-muted-foreground">Includes the under-age driver fee.</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
