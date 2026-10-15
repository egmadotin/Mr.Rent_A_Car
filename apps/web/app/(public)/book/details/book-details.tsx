"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Textarea } from "@mrac/ui/components/textarea";
import { COUNTRIES } from "@mrac/ui/lib/countries";
import { BUSINESS_TZ, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { toQuery, type BookingSearch } from "../../_components/booking-widget";
import { BookingBanner, BookingSummary, legacyStamp } from "../booking-summary";
import { decodeExtras } from "../options/book-options";
import { BookingSteps } from "../steps";
import { CardField, type ConfirmCard } from "./card-field";

type Errors = Record<string, string[] | undefined>;

/** mrrentacar.com "Reservation Information" → Customer Information, in its order and wording (all required but Special Request). */
const FIELDS: { id: string; label: string; type?: string; auto?: string }[] = [
  { id: "firstName", label: "First Name", auto: "given-name" },
  { id: "lastName", label: "Last Name", auto: "family-name" },
  { id: "email", label: "Email", type: "email", auto: "email" },
  { id: "phone", label: "Phone", type: "tel", auto: "tel" },
  { id: "birthDate", label: "Birth Day", type: "date", auto: "bday" },
  { id: "address", label: "Address", auto: "street-address" },
  { id: "city", label: "City", auto: "address-level2" },
  { id: "province", label: "State/Province", auto: "address-level1" },
  { id: "country", label: "Country" },
  { id: "postal", label: "Zip/Postal Code", auto: "postal-code" },
  { id: "licenseNumber", label: "Driver License Number" },
  { id: "licenseExpiry", label: "Driver's License Exp.", type: "date" },
  { id: "licenseProvince", label: "Driver's License State" },
];

const ageAt = (birth: string, at: Date) => {
  const b = new Date(`${birth}T00:00:00Z`);
  if (Number.isNaN(+b)) return null;
  let a = at.getUTCFullYear() - b.getUTCFullYear();
  if (at.getUTCMonth() < b.getUTCMonth() || (at.getUTCMonth() === b.getUTCMonth() && at.getUTCDate() < b.getUTCDate())) a--;
  return a >= 16 && a <= 120 ? a : null;
};

/** Step 3 of 3: the renter's details, "I accept the rental policy", Reserve. No online payment is taken. */
export function BookDetails({ search, vehicleTypeId, insuranceId, extras }: { search: BookingSearch; vehicleTypeId: string; insuranceId?: string; extras?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const locations = useQuery(trpc.customer.locations.queryOptions()).data;
  // search times are wall-clock time at the pickup location
  const tz = locations?.find((l) => l.id === search.pickup)?.timeZone ?? BUSINESS_TZ;
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [birth, setBirth] = React.useState("2000-01-01");
  const pay = useQuery(trpc.customer.paymentConfig.queryOptions()).data;
  const confirmCard = React.useRef<ConfirmCard | null>(null);

  const searchInput = {
    pickupLocationId: search.pickup ?? "",
    returnLocationId: search.return ?? search.pickup ?? "",
    pickupAt: fromDateTimeLocal(search.from, tz),
    returnAt: fromDateTimeLocal(search.to, tz),
    promoCode: search.promo,
  };
  const miscCharges = Object.entries(decodeExtras(extras)).map(([miscChargeId, quantity]) => ({ miscChargeId, quantity }));
  const age = ageAt(birth, searchInput.pickupAt);
  const quote = useQuery({
    ...trpc.customer.quote.queryOptions({ ...searchInput, vehicleTypeId, insuranceId: insuranceId ?? null, miscCharges, driverAge: age }),
    placeholderData: (p) => p,
  });
  const vt = useQuery(trpc.customer.fleet.queryOptions({})).data?.find((t) => t.id === vehicleTypeId);
  const locName = (id?: string) => locations?.find((l) => l.id === id)?.name ?? "…";
  const when = (v?: string) => (v ? legacyStamp(fromDateTimeLocal(v, tz), tz) : "");
  const back = new URLSearchParams(toQuery(search));
  back.set("type", vehicleTypeId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      // card first: Stripe confirms it in the browser, then the reservation is created with the intent id
      const stripeIntentId = pay?.enabled
        ? await confirmCard.current!(() =>
            client.customer.prepareCard.mutate({ search: searchInput, vehicleTypeId, insuranceId: insuranceId ?? null, miscCharges, birthDate: g("birthDate") as never, email: g("email"), name: `${g("firstName")} ${g("lastName")}`.trim() }),
          )
        : undefined;
      const res = await client.customer.requestReservation.mutate({
        stripeIntentId,
        search: searchInput,
        vehicleTypeId,
        insuranceId: insuranceId ?? null,
        miscCharges,
        ...(Object.fromEntries(FIELDS.map((x) => [x.id, g(x.id)])) as Record<string, string>),
        notes: g("notes") || undefined,
        acceptPolicy: f.get("acceptPolicy") === "on",
        website: g("website") || undefined,
      } as never);
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

  return (
    <>
      <BookingBanner title="Reservation Information" />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <BookingSteps current={3} hrefs={[`/book?${toQuery(search)}`, `/book/options?${back}`]} />
        <BookingSummary
          pickup={{ location: locName(search.pickup), when: when(search.from) }}
          dropoff={{ location: locName(search.return ?? search.pickup), when: when(search.to) }}
          vehicle={vt}
          lines={quote.data?.lines}
          total={quote.data?.total}
        />

        <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-6 border-t pt-8">
          <h2 className="text-xl">Customer Information</h2>
          {formError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((x) => (
              <div key={x.id} className="space-y-1.5">
                <Label htmlFor={x.id} className="text-xs uppercase text-muted-foreground">{x.label} *</Label>
                {x.id === "country" ? (
                  <NativeSelect id="country" name="country" defaultValue="Canada" aria-invalid={!!err("country")}>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </NativeSelect>
                ) : (
                  <Input
                    id={x.id}
                    name={x.id}
                    type={x.type ?? "text"}
                    autoComplete={x.auto}
                    placeholder={x.label}
                    aria-invalid={!!err(x.id)}
                    required
                    {...(x.id === "birthDate" ? { value: birth, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setBirth(e.target.value) } : {})}
                  />
                )}
                {err(x.id) && <p className="text-xs text-destructive">{err(x.id)}</p>}
              </div>
            ))}
            {pay?.enabled && (
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-xs uppercase text-muted-foreground">Credit Card *</span>
                <CardField publishableKey={pay.publishableKey} mode={pay.onlineMode === "AUTHORIZE" ? "AUTHORIZE" : "SAVE_CARD"} amountCents={Math.round(Number(quote.data?.total ?? 0) * 100)} confirmRef={confirmCard} />
                <p className="text-xs text-muted-foreground">
                  {pay.onlineMode === "AUTHORIZE" ? "The booking total is held on your card (not charged) until pick-up." : "Your card is kept securely by Stripe; nothing is charged now."}
                </p>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes" className="text-xs uppercase text-muted-foreground">Special Request/Local Information</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Special Request/Local Information" />
            </div>
            {/* honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl">Terms &amp; Conditions</h2>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="acceptPolicy" className="size-4 accent-primary" /> I accept the rental policy
            </label>
            {err("acceptPolicy") && <p className="text-xs text-destructive">{err("acceptPolicy")}</p>}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Reserve</Button>
          </div>
        </form>
      </div>
    </>
  );
}
