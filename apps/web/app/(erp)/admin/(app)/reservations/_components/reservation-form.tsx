"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, ChevronDownIcon, Link2OffIcon, Loader2Icon, UserCheckIcon, UsersIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Textarea } from "@mrac/ui/components/textarea";
import { toast } from "@mrac/ui/components/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrac/ui/components/tooltip";
import { date, money } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { cn } from "@mrac/ui/lib/utils";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { ChargeSummary, DiscountField, FormAlert, bookingWindow, initialBookingTimes, tzLabel } from "../../../../_components/booking-kit";
import { FieldShell as F, FormErrorsContext, PAYMENT_METHOD_OPTIONS, errorMessage, fieldErrorsOf } from "../../../../_components/form";

type Values = Record<string, string | boolean>;
type Misc = Record<string, number>;

const CUSTOMER_FIELDS = [
  "firstName", "middleName", "lastName", "email", "phone", "localPhone", "licenseNumber", "licenseExpiry", "licenseProvince",
  "birthDate", "address1", "address2", "city", "province", "postal", "country", "insuranceCompany", "insurancePolicyNumber",
  "insuranceExpiry", "insurancePhone", "insuranceFax",
] as const;
const DATE_FIELDS = new Set(["licenseExpiry", "birthDate", "insuranceExpiry"]);

export type ReservationFormInitial = { reservationId?: string; values: Values; misc: Misc };

export function ReservationForm({
  initial,
  defaultLocationId,
  startRentalAfterSave,
}: {
  initial?: ReservationFormInitial;
  defaultLocationId?: string;
  /** "Start Rental" from a quote: open the Start rental dialog once saved */
  startRentalAfterSave?: boolean;
}) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const editing = !!initial?.reservationId;
  const { data: o } = useQuery(trpc.staff.reservation.formOptions.queryOptions());

  const [v, setV] = React.useState<Values>(() => {
    return {
      status: "TENTATIVE",
      saveCustomer: true,
      locationId: defaultLocationId ?? "",
      pickupLocationId: defaultLocationId ?? "",
      returnLocationId: defaultLocationId ?? "",
      ...initial?.values,
      ...initialBookingTimes(initial?.values),
    };
  });
  const [misc, setMisc] = React.useState<Misc>(initial?.misc ?? {});
  const [customerId, setCustomerId] = React.useState<string | null>((initial?.values.customerId as string) || null);
  const [showMore, setShowMore] = React.useState(false);
  const [showTravel, setShowTravel] = React.useState(false);
  const [showMisc, setShowMisc] = React.useState(Object.keys(initial?.misc ?? {}).length > 0);
  const [takePayment, setTakePayment] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [undesired, setUndesired] = React.useState<null | "customer" | "company">(null);

  React.useEffect(() => {
    if (!o) return;
    const first = o.locations[0]?.id ?? "";
    setV((s) => ({
      ...s,
      locationId: s.locationId || first,
      pickupLocationId: s.pickupLocationId || first,
      returnLocationId: s.returnLocationId || first,
    }));
  }, [o]);

  const set = (name: string, value: string | boolean) => setV((s) => ({ ...s, [name]: value }));
  const str = (name: string) => (typeof v[name] === "string" ? (v[name] as string) : "");
  const bind = (name: string) => ({
    id: name,
    name,
    value: str(name),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(name, e.target.value),
    "aria-invalid": errors[name] ? (true as const) : undefined,
  });

  // ── live pricing
  const { tz, pickupAt, returnAt, valid: validWindow } = bookingWindow(o?.locations, str("pickupLocationId"), str("pickupAt"), str("returnAt"));
  const miscList = Object.entries(misc).filter(([, q]) => q > 0).map(([miscChargeId, quantity]) => ({ miscChargeId, quantity }));
  const preview = useQuery({
    ...trpc.staff.reservation.preview.queryOptions({
      pickupAt: pickupAt ?? new Date(),
      returnAt: returnAt ?? new Date(),
      locationId: str("pickupLocationId"),
      vehicleTypeId: str("vehicleTypeId"),
      rateId: str("rateId") || null,
      discountType: (str("discountType") || null) as "PERCENT" | "AMOUNT" | null,
      discountValue: str("discountValue") ? Number(str("discountValue")) : null,
      miscCharges: miscList,
      insuranceId: str("insuranceId") || null,
    }),
    enabled: validWindow && !!str("vehicleTypeId") && !!str("pickupLocationId"),
  });

  const available = useQuery({
    ...trpc.staff.reservation.availableVehicles.queryOptions({
      vehicleTypeId: str("vehicleTypeId"),
      locationId: str("pickupLocationId"),
      pickupAt: pickupAt ?? new Date(),
      returnAt: returnAt ?? new Date(),
      excludeReservationId: initial?.reservationId,
    }),
    enabled: validWindow && !!str("vehicleTypeId") && !!str("pickupLocationId"),
  });

  // ── Check Matching (duplicate customers)
  const [matchKey, setMatchKey] = React.useState({ firstName: "", lastName: "", phone: "", email: "", licenseNumber: "" });
  React.useEffect(() => {
    const t = setTimeout(
      () => setMatchKey({ firstName: str("firstName"), lastName: str("lastName"), phone: str("phone"), email: str("email"), licenseNumber: str("licenseNumber") }),
      400,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.firstName, v.lastName, v.phone, v.email, v.licenseNumber]);
  const matches = useQuery({
    ...trpc.staff.reservation.checkMatching.queryOptions(matchKey),
    enabled: !customerId && (matchKey.lastName.length >= 2 || matchKey.phone.replace(/\D/g, "").length >= 7 || matchKey.email.includes("@")),
  });

  function applyCustomer(c: NonNullable<typeof matches.data>[number]) {
    setCustomerId(c.id);
    setV((s) => {
      const next = { ...s };
      for (const f of CUSTOMER_FIELDS) {
        const val = (c as Record<string, unknown>)[f];
        next[f] = val == null ? "" : DATE_FIELDS.has(f) ? new Date(val as string).toISOString().slice(0, 10) : String(val);
      }
      return next;
    });
    if (c.isUndesired) toast.warning("This customer is on the undesired (do-not-rent) list.");
  }

  const rates = (o?.rates ?? []).filter((r) => r.locationId === str("pickupLocationId") && (!str("vehicleTypeId") || r.vehicleTypeIds.includes(str("vehicleTypeId"))));
  const period = validWindow ? describePeriod(+returnAt! - +pickupAt!) : null;

  async function submit(allowUndesired = false) {
    setPending(true);
    setErrors({});
    setFormError(null);
    const customer = Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, str(f)]));
    const data = {
      status: str("status") as "TENTATIVE",
      quoteId: str("quoteId") || null,
      customerId,
      saveCustomer: v.saveCustomer === true,
      allowUndesired,
      customer: { ...customer, memo: str("customerMemo") },
      locationId: str("locationId"),
      pickupLocationId: str("pickupLocationId"),
      returnLocationId: str("returnLocationId"),
      pickupAt: pickupAt as Date,
      returnAt: returnAt as Date,
      vehicleTypeId: str("vehicleTypeId"),
      vehicleId: str("vehicleId") || null,
      rateId: str("rateId") || null,
      companyId: str("companyId") || null,
      discountType: str("discountType") || null,
      discountValue: str("discountValue"),
      discountReasonId: str("discountReasonId") || null,
      deposit: str("deposit"),
      referralId: str("referralId") || null,
      deliveryAddress: str("deliveryAddress"),
      airline: str("airline"),
      flightNumber: str("flightNumber"),
      hotel: str("hotel"),
      arrivalAirport: str("arrivalAirport"),
      preferredLanguage: str("preferredLanguage"),
      poNumber: str("poNumber"),
      roNumber: str("roNumber"),
      customerNotes: str("customerNotes"),
      isLoaner: v.isLoaner === true,
      isNonRevenue: v.isNonRevenue === true,
      memo: str("memo"),
      memoShowAsPopup: v.memoShowAsPopup === true,
      miscCharges: miscList,
      insuranceId: str("insuranceId") || null,
      payment:
        takePayment && !editing
          ? {
              method: str("payMethod"),
              transactionType: str("payType") || "PAYMENT",
              amount: str("payAmount"),
              authorizationCode: str("payAuth"),
              transactionCode: str("payTxn"),
              cardLast4: str("payLast4"),
            }
          : null,
    };
    try {
      const res = editing
        ? await client.staff.reservation.update.mutate({ reservationId: initial!.reservationId!, data: data as never })
        : await client.staff.reservation.create.mutate(data as never);
      toast.success(editing ? "Reservation updated" : "Reservation saved");
      router.push(`/admin/reservations/${res.id}${startRentalAfterSave ? "?start=1" : ""}`);
    } catch (err) {
      const msg = errorMessage(err);
      if (msg === "UNDESIRED_CUSTOMER") return setUndesired("customer");
      if (msg === "UNDESIRED_COMPANY") return setUndesired("company");
      const fe = fieldErrorsOf(err);
      // renter errors arrive as "customer.firstName" etc.
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : msg);
      toast.error(Object.keys(fe).length ? "Fix the highlighted fields." : msg);
    } finally {
      setPending(false);
    }
  }

  if (!o) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>);
  const company = o.companies.find((c) => c.id === str("companyId"));

  return (
    <FormErrorsContext.Provider value={errors}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="grid gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="min-w-0 space-y-6">
          <FormAlert message={formError} />

          {/* ── Renter ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-base">Renter</CardTitle>
                <CardDescription>Type a name or phone — matching customers appear so you don’t create a duplicate.</CardDescription>
              </div>
              {customerId && (
                <div className="flex items-center gap-2">
                  <Badge variant="success"><UserCheckIcon /> Existing customer</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCustomerId(null)}>
                    <Link2OffIcon /> Unlink
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <F label="First name" name="firstName" required errorKey="customer.firstName"><Input {...bind("firstName")} autoComplete="off" /></F>
                <F label="Middle name" name="middleName"><Input {...bind("middleName")} autoComplete="off" /></F>
                <F label="Last name" name="lastName" required errorKey="customer.lastName"><Input {...bind("lastName")} autoComplete="off" /></F>
                <F label="Email" name="email" errorKey="customer.email"><Input type="email" {...bind("email")} autoComplete="off" /></F>
                <F label="Phone" name="phone"><Input type="tel" {...bind("phone")} autoComplete="off" /></F>
                <F label="Local phone" name="localPhone"><Input type="tel" {...bind("localPhone")} autoComplete="off" /></F>
              </div>

              {!customerId && (matches.data?.length ?? 0) > 0 && (
                <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <UsersIcon className="size-4" /> {matches.data!.length} possible match{matches.data!.length > 1 ? "es" : ""} — use one instead of creating a new customer?
                  </p>
                  <ul className="divide-y rounded-md border bg-card text-sm">
                    {matches.data!.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                        <span>
                          <span className="font-medium">{[c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")}</span>{" "}
                          <span className="text-muted-foreground">
                            {[c.phone, c.email, c.licenseNumber && `Lic ${c.licenseNumber}`, c.birthDate && `DOB ${date(c.birthDate)}`].filter(Boolean).join(" · ")}
                          </span>{" "}
                          {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
                          {!c.isActive && <Badge variant="muted">Inactive</Badge>}
                        </span>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyCustomer(c)}>Use this customer</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Disclosure open={showMore} onToggle={() => setShowMore((x) => !x)} label="Licence, address & insurance">
                <div className="grid gap-4 sm:grid-cols-3">
                  <F label="Driver's licence #" name="licenseNumber"><Input {...bind("licenseNumber")} /></F>
                  <F label="Licence expiry" name="licenseExpiry"><Input type="date" {...bind("licenseExpiry")} /></F>
                  <F label="Licence province / state" name="licenseProvince">
                    <NativeSelect {...bind("licenseProvince")}><option value="">—</option>{REGION_OPTIONS.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
                  </F>
                  <F label="Date of birth" name="birthDate"><Input type="date" {...bind("birthDate")} /></F>
                  <F label="Address" name="address1"><Input {...bind("address1")} /></F>
                  <F label="Address 2" name="address2"><Input {...bind("address2")} /></F>
                  <F label="City" name="city"><Input {...bind("city")} /></F>
                  <F label="Province / state" name="province">
                    <NativeSelect {...bind("province")}><option value="">—</option>{REGION_OPTIONS.map((r) => <option key={r}>{r}</option>)}</NativeSelect>
                  </F>
                  <F label="Postal / zip" name="postal"><Input {...bind("postal")} /></F>
                  <F label="Country" name="country"><Input {...bind("country")} /></F>
                  <F label="Insurance company" name="insuranceCompany"><Input {...bind("insuranceCompany")} /></F>
                  <F label="Policy #" name="insurancePolicyNumber"><Input {...bind("insurancePolicyNumber")} /></F>
                  <F label="Insurance expiry" name="insuranceExpiry"><Input type="date" {...bind("insuranceExpiry")} /></F>
                  <F label="Insurance phone" name="insurancePhone"><Input type="tel" {...bind("insurancePhone")} /></F>
                  <F label="Insurance fax" name="insuranceFax"><Input type="tel" {...bind("insuranceFax")} /></F>
                  {!customerId && <F label="Customer memo" name="customerMemo" className="sm:col-span-3"><Textarea rows={2} {...bind("customerMemo")} /></F>}
                </div>
              </Disclosure>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={v.saveCustomer === true} onChange={(e) => set("saveCustomer", e.target.checked)} />
                {customerId ? "Update the customer record with these details" : "Save this renter as a new customer"}
              </label>
            </CardContent>
          </Card>

          {/* ── Trip ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Trip & vehicle</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <F label="Booking location" name="locationId" required><NativeSelect {...bind("locationId")}>{opt(o.locations)}</NativeSelect></F>
              <F label="Pickup location" name="pickupLocationId" required><NativeSelect {...bind("pickupLocationId")}>{opt(o.locations)}</NativeSelect></F>
              <F label="Return location" name="returnLocationId" required>
                <NativeSelect {...bind("returnLocationId")}>{opt(o.locations)}</NativeSelect>
              </F>
              <F label={`Pickup date & time (${tzLabel(tz)})`} name="pickupAt" required><Input type="datetime-local" {...bind("pickupAt")} /></F>
              <F label={`Return date & time (${tzLabel(tz)})`} name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
              <div className="space-y-1.5">
                <Label>Period</Label>
                <div className="flex h-9 items-center text-sm text-muted-foreground">
                  {period ?? "—"}
                  {str("pickupLocationId") && str("returnLocationId") && str("pickupLocationId") !== str("returnLocationId") && <Badge variant="info" className="ml-2">One way</Badge>}
                </div>
              </div>
              <F label="Vehicle type" name="vehicleTypeId" required>
                <NativeSelect {...bind("vehicleTypeId")}><option value="">Please select</option>{opt(o.vehicleTypes)}</NativeSelect>
              </F>
              <F label="Rate" name="rateId" hint={str("vehicleTypeId") && rates.length === 0 ? "No rate for this type at the pickup location." : undefined}>
                <NativeSelect {...bind("rateId")}><option value="">— No rate —</option>{rates.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}</NativeSelect>
              </F>
              <F label="Vehicle" name="vehicleId" hint={validWindow && str("vehicleTypeId") ? `${available.data?.length ?? 0} free for these dates` : "Choose type and dates first"}>
                <NativeSelect {...bind("vehicleId")} disabled={!validWindow || !str("vehicleTypeId")}>
                  <option value="">Assign later</option>
                  {(available.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.assignedId} — {x.year} {x.make.name} {x.model.name}</option>)}
                  {str("vehicleId") && !available.data?.some((x) => x.id === str("vehicleId")) && <option value={str("vehicleId")}>Currently assigned vehicle</option>}
                </NativeSelect>
              </F>
              <F label="Company" name="companyId">
                <NativeSelect {...bind("companyId")}><option value="">—</option>{o.companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isUndesired ? " (undesired)" : ""}</option>)}</NativeSelect>
              </F>
              <DiscountField bind={bind} error={errors.discountValue?.[0]} />
              <F label="Discount reason" name="discountReasonId">
                <NativeSelect {...bind("discountReasonId")}><option value="">—</option>{opt(o.discountReasons)}</NativeSelect>
              </F>
              <F label="Protection" name="insuranceId" hint="Defaults to the location's default coverage.">
                <NativeSelect {...bind("insuranceId")}>
                  <option value="">Location default</option>
                  {o.insurances
                    .filter((i) => !i.locationId || i.locationId === str("pickupLocationId"))
                    .map((i) => (
                      <option key={i.id} value={i.id}>{i.name} — {money(i.dailyRate)}/day{i.deductible && Number(i.deductible) > 0 ? ` · ${money(i.deductible)} ded.` : ""}</option>
                    ))}
                </NativeSelect>
              </F>
              <F label="Deposit" name="deposit"><Input type="number" min={0} step="0.01" {...bind("deposit")} /></F>
              <F label="Referral" name="referralId"><NativeSelect {...bind("referralId")}><option value="">None</option>{opt(o.referrals)}</NativeSelect></F>
              {company?.isUndesired && (
                <p className="flex items-center gap-2 text-sm text-destructive sm:col-span-2 lg:col-span-3"><AlertTriangleIcon className="size-4" /> {company.name} is on the undesired list.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Other charges ───────────────────────────────────────── */}
          <Card>
            <CardContent>
              <Disclosure open={showMisc} onToggle={() => setShowMisc((x) => !x)} label={`Other charges${miscList.length ? ` (${miscList.length})` : ""}`}>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {o.miscCharges.filter((m) => (!m.locationId || m.locationId === str("pickupLocationId")) && !m.isDefault).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <label htmlFor={`misc-${m.id}`} className="min-w-0 truncate">
                        {m.name} <span className="text-muted-foreground">{money(m.rate)}{m.calculationBy === "FLAT" ? "" : "/day"}</span>
                      </label>
                      <Input
                        id={`misc-${m.id}`}
                        type="number"
                        min={0}
                        className="h-8 w-16"
                        value={misc[m.id] ?? 0}
                        onChange={(e) => setMisc((s) => ({ ...s, [m.id]: Math.max(0, Number(e.target.value) || 0) }))}
                      />
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </CardContent>
          </Card>

          {/* ── Travel, references, memo ───────────────────────────── */}
          <Card>
            <CardContent className="space-y-4">
              <Disclosure open={showTravel} onToggle={() => setShowTravel((x) => !x)} label="Delivery, travel & references">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <F label="Delivery address" name="deliveryAddress" className="sm:col-span-2 lg:col-span-3"><Input {...bind("deliveryAddress")} /></F>
                  <F label="Airline" name="airline"><Input {...bind("airline")} /></F>
                  <F label="Flight #" name="flightNumber"><Input {...bind("flightNumber")} /></F>
                  <F label="Arrival airport" name="arrivalAirport"><Input {...bind("arrivalAirport")} /></F>
                  <F label="Hotel" name="hotel"><Input {...bind("hotel")} /></F>
                  <F label="Preferred language" name="preferredLanguage"><Input {...bind("preferredLanguage")} /></F>
                  <F label="PO#" name="poNumber"><Input {...bind("poNumber")} /></F>
                  <F label="RO#" name="roNumber"><Input {...bind("roNumber")} /></F>
                  <F label="Customer notes" name="customerNotes" className="sm:col-span-2 lg:col-span-3"><Textarea rows={2} {...bind("customerNotes")} /></F>
                </div>
              </Disclosure>
              <div className="grid gap-4 sm:grid-cols-2">
                <F label={editing ? "Add memo" : "Memo"} name="memo" className="sm:col-span-2"><Textarea rows={2} {...bind("memo")} /></F>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.memoShowAsPopup === true} onChange={(e) => set("memoShowAsPopup", e.target.checked)} /> Always display memo as popup</label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.isNonRevenue === true} onChange={(e) => set("isNonRevenue", e.target.checked)} /> Non-revenue</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.isLoaner === true} onChange={(e) => set("isLoaner", e.target.checked)} /> Loaner</label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Summary / payment / save (sticky) ───────────────────── */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <ChargeSummary title="Charge summary" preview={preview.data} emptyText="Choose dates, location and vehicle type to see charges." />

          {!editing && (
            <Card className="gap-3">
              <CardHeader>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox checked={takePayment} onChange={(e) => setTakePayment(e.target.checked)} /> Take a payment now
                </label>
              </CardHeader>
              {takePayment && (
                <CardContent className="grid gap-3">
                  <F label="Payment method" name="payMethod" required><NativeSelect {...bind("payMethod")}><option value="">Please select</option>{PAYMENT_METHOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></F>
                  <F label="Amount" name="payAmount" required><Input type="number" min={0.01} step="0.01" {...bind("payAmount")} /></F>
                  <F label="Transaction type" name="payType">
                    <NativeSelect {...bind("payType")}><option value="PAYMENT">Payment (Credit)</option><option value="AUTHORIZATION">Authorization</option><option value="REFUND">Refund</option></NativeSelect>
                  </F>
                  <F label="Card last 4" name="payLast4"><Input inputMode="numeric" maxLength={4} {...bind("payLast4")} /></F>
                  <F label="Authorization code" name="payAuth"><Input {...bind("payAuth")} /></F>
                  <F label="Transaction code" name="payTxn"><Input {...bind("payTxn")} /></F>
                </CardContent>
              )}
            </Card>
          )}

          <Card className="gap-3">
            <CardContent className="space-y-3">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Status</legend>
                <div className="flex gap-4">
                  {(["TENTATIVE", "CONFIRMED"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="status" value={s} checked={str("status") === s} onChange={() => set("status", s)} className="accent-primary" />
                      {s === "TENTATIVE" ? "Tentative" : "Confirmed"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="flex w-fit items-center gap-2 text-sm text-muted-foreground"><Checkbox disabled /> Email confirmation to renter</label>
                </TooltipTrigger>
                <TooltipContent>Available once an email provider is configured.</TooltipContent>
              </Tooltip>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" asChild>
                  <Link href={editing ? `/admin/reservations/${initial!.reservationId}` : "/admin/reservations"}>Cancel</Link>
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  {editing ? "Save changes" : "Save reservation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>

      <ConfirmAction
        open={undesired !== null}
        onOpenChange={(open) => !open && setUndesired(null)}
        destructive
        title={undesired === "company" ? "Undesired company" : "Undesired customer"}
        description={`This ${undesired} is on the undesired (do-not-rent) list. Save the reservation anyway?`}
        confirmLabel="Save anyway"
        onConfirm={async () => {
          setUndesired(null);
          await submit(true);
        }}
      />
    </FormErrorsContext.Provider>
  );
}

function describePeriod(ms: number) {
  const mins = Math.round(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  return [d && `${d} day${d > 1 ? "s" : ""}`, h && `${h} hr${h > 1 ? "s" : ""}`].filter(Boolean).join(" ") || "< 1 hr";
}

function Disclosure({ open, onToggle, label, children }: { open: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between py-1 text-sm font-medium hover:text-primary">
        {label}
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}
