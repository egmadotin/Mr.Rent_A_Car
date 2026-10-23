"use client";

import * as React from "react";
import Link from "next/link";
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
  // logged-in customer: their details are filled in (they can still change them for this booking)
  const me = useQuery(trpc.account.me.queryOptions()).data;
  const mine = me?.customer;
  const ymd = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const prefill: Record<string, string> = me
    ? {
        firstName: mine?.firstName ?? me.name.split(" ")[0] ?? "", lastName: mine?.lastName ?? me.name.split(" ").slice(1).join(" "), email: mine?.email ?? me.email,
        phone: mine?.phone ?? "", address: mine?.address1 ?? "", city: mine?.city ?? "", province: mine?.province ?? "", postal: mine?.postal ?? "",
        licenseNumber: mine?.licenseNumber ?? "", licenseExpiry: ymd(mine?.licenseExpiry), licenseProvince: mine?.licenseProvince ?? "",
      }
    : {};
  React.useEffect(() => {
    if (mine?.birthDate) setBirth(ymd(mine.birthDate));
  }, [mine?.birthDate]);
  const policy = useQuery(trpc.customer.rentalPolicies.queryOptions()).data;
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
      <div className="mx-auto w-full max-w-[1100px] space-y-8 px-4 py-8 sm:px-8">
        <BookingSteps current={3} hrefs={[`/book?${toQuery(search)}`, `/book/options?${back}`]} />
        <BookingBanner title="Your details" />
        <BookingSummary
          pickup={{ location: locName(search.pickup), when: when(search.from) }}
          dropoff={{ location: locName(search.return ?? search.pickup), when: when(search.to) }}
          vehicle={vt}
          lines={quote.data?.lines}
          total={quote.data?.total}
          promo={quote.data?.promo}
        />

        <form key={me ? "me" : "guest"} onSubmit={submit} noValidate className="space-y-6 rounded-card border bg-card p-5 sm:p-8">
          <h2 className="type-title-3">Driver details</h2>
          {me ? (
            <p className="rounded-control bg-muted px-4 py-3 text-sm">Booking as <span className="font-semibold">{me.name}</span> — your details are filled in; check them before you reserve.</p>
          ) : (
            <p className="rounded-control bg-muted px-4 py-3 text-sm">
              Have an account?{" "}
              <Link
                href="/account/login"
                onClick={(e) => { e.preventDefault(); router.push(`/account/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }}
                className="font-semibold text-foreground underline underline-offset-2 hover:text-brand"
              >Log in</Link>{" "}
              to fill in your details — or just continue as a guest.
            </p>
          )}
          {formError && <p role="alert" className="rounded-control bg-blush px-4 py-3 text-sm font-semibold text-brand">{formError}</p>}
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((x) => (
              <div key={x.id} className="space-y-1.5">
                <Label htmlFor={x.id} className="text-muted-foreground">{x.label}</Label>
                {x.id === "country" ? (
                  <NativeSelect id="country" name="country" defaultValue={mine?.country && (COUNTRIES as readonly string[]).includes(mine.country) ? mine.country : "Canada"} aria-invalid={!!err("country")}>
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
                    defaultValue={x.id === "birthDate" ? undefined : prefill[x.id]}
                    required
                    {...(x.id === "birthDate" ? { value: birth, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setBirth(e.target.value) } : {})}
                  />
                )}
                {err(x.id) && <p className="text-xs text-destructive">{err(x.id)}</p>}
              </div>
            ))}
            {pay?.enabled && (
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-[13px] font-semibold text-muted-foreground">Credit card</span>
                <CardField publishableKey={pay.publishableKey} mode={pay.onlineMode === "AUTHORIZE" ? "AUTHORIZE" : "SAVE_CARD"} amountCents={Math.round(Number(quote.data?.total ?? 0) * 100)} confirmRef={confirmCard} />
                <p className="text-xs text-muted-foreground">
                  {pay.onlineMode === "AUTHORIZE" ? "The booking total is held on your card (not charged) until pick-up." : "Your card is kept securely by Stripe; nothing is charged now."}
                </p>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes" className="text-muted-foreground">Special requests or local address <span className="font-normal">(optional)</span></Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            {/* honeypot */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          </div>

          <div className="space-y-3 border-t pt-6">
            <h2 className="type-heading">Rental policy</h2>
            {policy && (
              <details className="rounded-control border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-semibold">Read the rental policy</summary>
                {/* written by staff in Settings > Rental Policies */}
                <div className="mt-2 space-y-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: policy }} />
              </details>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="acceptPolicy" className="size-4 accent-[var(--ink)]" /> I accept the rental policy
            </label>
            {err("acceptPolicy") && <p className="text-xs text-destructive">{err("acceptPolicy")}</p>}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Reserve</Button>
          </div>
        </form>
      </div>
    </>
  );
}
