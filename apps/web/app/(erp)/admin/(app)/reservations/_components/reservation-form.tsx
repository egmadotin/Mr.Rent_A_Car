"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, Loader2Icon, PlusCircleIcon, RefreshCwIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { Textarea } from "@mrac/ui/components/textarea";
import { COUNTRIES } from "@mrac/ui/lib/countries";
import { date, money } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { ChargeSummary, DiscountField, FormAlert, bookingWindow, initialBookingTimes } from "../../../../_components/booking-kit";
import { CompanySearch } from "../../../../_components/company-search";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { FieldShell as F, FormErrorsContext, PAYMENT_METHOD_OPTIONS, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { legacyDate } from "../../../../_components/list-kit";
import { OptionsGrid, emptyOptions, useBookingOptions, type BookingOptions } from "../../../../_components/options-grid";
import { ReferralField } from "../../../../_components/referral-field";
import { SearchPicker } from "../../../../_components/search-picker";

type Values = Record<string, string | boolean>;

const CUSTOMER_FIELDS = [
  "firstName", "middleName", "lastName", "email", "phone", "localPhone", "licenseNumber", "licenseExpiry", "licenseProvince",
  "birthDate", "address1", "address2", "city", "province", "postal", "country", "insuranceCompany", "insurancePolicyNumber",
  "insuranceExpiry", "insurancePhone", "insuranceFax",
] as const;
const DATE_FIELDS = new Set(["licenseExpiry", "birthDate", "insuranceExpiry"]);
/** Customer tab fields RentCentric marks required (checked on "Save and Goto Reservation Tab"). */
const CUSTOMER_REQUIRED: [string, string][] = [
  ["firstName", "First Name"], ["lastName", "Last Name"], ["licenseNumber", "Driver's Lic.#"], ["licenseExpiry", "Lic.Exp"],
  ["licenseProvince", "Lic.State"], ["birthDate", "Date of birth"], ["country", "Country"], ["province", "State/Province"],
  ["phone", "Phone"], ["email", "Email"],
];
/** Status tick boxes of the Reserve form (they behave as one choice); Rented / Checked In come from the rental. */
const STATUSES = [
  ["CONFIRMED", "Confirmed"], ["TENTATIVE", "Tentative"], ["CANCELLED", "Cancelled"], ["CHECKED_OUT", "Rented"], ["CHECKED_IN", "Checked In"],
] as const;

export type ReservationFormInitial = { reservationId?: string; number?: number; createdAt?: string; values: Values; options?: BookingOptions };

/**
 * Reserve (ReservationsModfiy.aspx) — the Customer tab (primary driver profile) and the Reservation tab, field for field,
 * with the options grid (same as Add Quote), "Update Charges Summary" and the Payment Information panel.
 */
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

  const [tab, setTab] = React.useState("reservation");
  const [v, setV] = React.useState<Values>(() => ({
    status: "CONFIRMED",
    saveCustomer: false,
    country: "Canada",
    province: "British Columbia",
    licenseProvince: "British Columbia",
    discountType: "PERCENT",
    locationId: defaultLocationId ?? "",
    pickupLocationId: defaultLocationId ?? "",
    returnLocationId: defaultLocationId ?? "",
    payType: "AUTHORIZATION",
    ...initial?.values,
    ...initialBookingTimes(initial?.values, { defaultAt: "09:00" }),
  }));
  const [opts, setOpts] = React.useState<BookingOptions>(initial?.options ?? emptyOptions());
  const [customerId, setCustomerId] = React.useState<string | null>((initial?.values.customerId as string) || null);
  const [paymentReady, setPaymentReady] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [undesired, setUndesired] = React.useState<null | "customer" | "company">(null);
  const [matchKey, setMatchKey] = React.useState<null | { firstName: string; lastName: string; phone: string; email: string; licenseNumber: string }>(null);

  React.useEffect(() => {
    if (!o) return;
    const first = o.locations[0]?.id ?? "";
    setV((s) => ({ ...s, locationId: s.locationId || first, pickupLocationId: s.pickupLocationId || first, returnLocationId: s.returnLocationId || first }));
  }, [o]);

  const set = (name: string, value: string | boolean) => setV((s) => ({ ...s, [name]: value }));
  const str = (name: string) => (typeof v[name] === "string" ? (v[name] as string) : "");
  const bind = (name: string) => ({
    id: name,
    name,
    value: str(name),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(name, e.target.value),
    "aria-invalid": errors[name] || errors[`customer.${name}`] ? (true as const) : undefined,
  });

  const { pickupAt, returnAt, valid: validWindow } = bookingWindow(o?.locations, str("pickupLocationId"), str("pickupAt"), str("returnAt"));
  const bo = useBookingOptions(str("pickupLocationId"), str("vehicleTypeId"), pickupAt, returnAt);
  React.useEffect(() => {
    if (bo.data && str("rateId") && !bo.data.rates.some((r) => r.id === str("rateId"))) set("rateId", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bo.data, v.rateId]);

  // "X Days" sets the return date from the pickup date; changing the dates updates it
  const xDays = validWindow ? Math.max(1, Math.ceil((+returnAt! - +pickupAt!) / 86_400_000)) : "";
  function setXDays(n: number) {
    const p = str("pickupAt");
    if (!p || !(n > 0)) return;
    const d = new Date(`${p}:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    set("returnAt", d.toISOString().slice(0, 16));
  }

  // "Update Charges Summary"
  const [previewOn, setPreviewOn] = React.useState(editing);
  const preview = useQuery({
    ...trpc.staff.booking.preview.queryOptions({
      pickupAt: pickupAt ?? new Date(),
      returnAt: returnAt ?? new Date(),
      locationId: str("pickupLocationId"),
      vehicleTypeId: str("vehicleTypeId"),
      rateId: str("rateId") || null,
      discountType: (str("discountValue") ? str("discountType") || null : null) as "PERCENT" | null,
      discountValue: str("discountValue") ? Number(str("discountValue")) : null,
      options: opts,
    }),
    enabled: previewOn && validWindow && !!str("vehicleTypeId") && !!str("pickupLocationId") && !!str("rateId"),
    placeholderData: (p) => p,
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

  // "Check Matching" (and the First Name search icon): existing customers like this one
  const matches = useQuery({ ...trpc.staff.reservation.checkMatching.queryOptions(matchKey ?? {}), enabled: !!matchKey && !customerId });
  const checkMatching = () => setMatchKey({ firstName: str("firstName"), lastName: str("lastName"), phone: str("phone"), email: str("email"), licenseNumber: str("licenseNumber") });

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
    setMatchKey(null);
    if (c.isUndesired) toast.warning("This customer is on the undesired (do-not-rent) list.");
  }

  function saveCustomerTab() {
    const missing = CUSTOMER_REQUIRED.filter(([k]) => !str(k).trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([k, label]) => [`customer.${k}`, [`${label} is required`]])));
      toast.error("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    set("saveCustomer", true);
    setTab("reservation");
  }

  async function submit(allowUndesired = false) {
    setPending(true);
    setErrors({});
    setFormError(null);
    const customer = Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, str(f)]));
    const pay = paymentReady && !editing && str("payMethod") && str("payAmount");
    const data = {
      status: str("status") as "CONFIRMED",
      sendConfirmationEmail: v.sendConfirmationEmail === true,
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
      discountType: str("discountValue") ? str("discountType") || null : null,
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
      options: opts,
      // CVV is never stored
      payment: pay
        ? { method: str("payMethod"), transactionType: str("payType") || "AUTHORIZATION", amount: str("payAmount"), authorizationCode: str("payAuth"), transactionCode: str("payTxn") }
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
      const fe = Object.fromEntries(Object.entries(fieldErrorsOf(err)).map(([k, val]) => [k.replace(/^data\./, ""), val]));
      setErrors(fe);
      const m = Object.keys(fe).length ? "Fix the highlighted fields." : msg;
      setFormError(m);
      toast.error(m);
    } finally {
      setPending(false);
    }
  }

  async function submitPayment() {
    if (!str("payMethod") || !(Number(str("payAmount")) > 0)) {
      setErrors({ payMethod: str("payMethod") ? undefined : ["Payment Method is required"], payAmount: Number(str("payAmount")) > 0 ? undefined : ["Amount is required"] });
      return;
    }
    if (!editing) {
      setPaymentReady(true);
      toast.success("Payment will be applied when the reservation is saved.");
      return;
    }
    try {
      await client.staff.reservation.addPayment.mutate({
        reservationId: initial!.reservationId!,
        method: str("payMethod") as "CASH",
        transactionType: (str("payType") || "AUTHORIZATION") as "AUTHORIZATION",
        amount: Number(str("payAmount")),
        authorizationCode: str("payAuth"),
        transactionCode: str("payTxn"),
        takenAt: new Date(),
      });
      toast.success("Payment applied");
      setV((s) => ({ ...s, payAmount: "", payAuth: "", payTxn: "" }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  if (!o) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>);
  const company = o.companies.find((c) => c.id === str("companyId"));
  const rates = bo.data?.rates ?? [];
  const cust = (k: string) => `customer.${k}`;
  const vehicles = (available.data ?? []).map((x) => ({ id: x.id, label: `${x.assignedId} — ${x.year} ${x.make.name} ${x.model.name}` }));
  if (str("vehicleId") && !vehicles.some((x) => x.id === str("vehicleId"))) vehicles.unshift({ id: str("vehicleId"), label: "Currently assigned vehicle" });
  const regionOptions = (sel: string) => [...new Set([...REGION_OPTIONS, ...(sel ? [sel] : [])])];
  const countries = [...new Set([...COUNTRIES, ...(str("country") ? [str("country")] : [])])];

  return (
    <FormErrorsContext.Provider value={errors}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4 p-4 md:p-6"
      >
        <FormAlert message={formError} />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="reservation">Reservation</TabsTrigger>
          </TabsList>

          {/* ── Customer tab: the primary driver ─────────────────────────── */}
          <TabsContent value="customer" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardHeader><CardTitle className="text-base">Primary Driver</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-xs space-y-1.5"><Label htmlFor="swipe">Swipe</Label><Input id="swipe" autoComplete="off" /></div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <F label="First Name" name="cust-firstName" errorKey={cust("firstName")} required>
                    <div className="relative">
                      <Input {...bind("firstName")} id="cust-firstName" autoComplete="off" className="pr-8" />
                      <button type="button" aria-label="Find customer" onClick={checkMatching} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"><SearchIcon className="size-4" /></button>
                    </div>
                  </F>
                  <F label="Middle Name" name="cust-middleName"><Input {...bind("middleName")} id="cust-middleName" autoComplete="off" /></F>
                  <F label="Last Name" name="cust-lastName" errorKey={cust("lastName")} required><Input {...bind("lastName")} id="cust-lastName" autoComplete="off" /></F>
                  <div className="hidden lg:block" />
                  <F label="Driver's Lic.#" name="licenseNumber" errorKey={cust("licenseNumber")} required><Input {...bind("licenseNumber")} /></F>
                  <F label="Lic.Exp" name="licenseExpiry" errorKey={cust("licenseExpiry")} required><Input type="date" {...bind("licenseExpiry")} /></F>
                  <F label="Lic.State" name="licenseProvince" errorKey={cust("licenseProvince")} required>
                    <NativeSelect {...bind("licenseProvince")}><option value="">Please select</option>{regionOptions(str("licenseProvince")).map((r) => <option key={r}>{r}</option>)}</NativeSelect>
                  </F>
                  <F label="Date of birth" name="birthDate" errorKey={cust("birthDate")} required><Input type="date" {...bind("birthDate")} /></F>
                  <F label="Address 1" name="address1"><Input {...bind("address1")} /></F>
                  <F label="Address 2" name="address2"><Input {...bind("address2")} /></F>
                  <F label="City" name="city"><Input {...bind("city")} /></F>
                  <F label="Zip / Postal" name="postal"><Input {...bind("postal")} /></F>
                  <F label="Country" name="country" errorKey={cust("country")} required>
                    <NativeSelect {...bind("country")}><option value="">Please select</option>{countries.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
                  </F>
                  <F label="State/Province" name="province" errorKey={cust("province")} required>
                    <NativeSelect {...bind("province")}><option value="">Please select</option>{regionOptions(str("province")).map((r) => <option key={r}>{r}</option>)}</NativeSelect>
                  </F>
                  <F label="Phone" name="cust-phone" errorKey={cust("phone")} required><Input type="tel" {...bind("phone")} id="cust-phone" /></F>
                  <F label="Local Phone" name="localPhone"><Input type="tel" {...bind("localPhone")} /></F>
                  <F label="Email" name="cust-email" errorKey={cust("email")} required><Input type="email" {...bind("email")} id="cust-email" /></F>
                  <div className="hidden lg:col-span-3 lg:block" />
                  <F label="Policy Number" name="insurancePolicyNumber"><Input {...bind("insurancePolicyNumber")} /></F>
                  <F label="Insurance Company" name="insuranceCompany"><Input {...bind("insuranceCompany")} /></F>
                  <F label="Insurance Expiration" name="insuranceExpiry"><Input type="date" {...bind("insuranceExpiry")} /></F>
                  <F label="Insurance Phone" name="insurancePhone"><Input type="tel" {...bind("insurancePhone")} /></F>
                  <F label="Insurance Fax" name="insuranceFax"><Input type="tel" {...bind("insuranceFax")} /></F>
                  <F label="Customer Notes" name="customerMemo" className="sm:col-span-2"><Textarea rows={3} {...bind("customerMemo")} /></F>
                </div>
                <MatchList matches={customerId ? [] : matches.data} onUse={applyCustomer} />
                <div className="flex justify-end">
                  <Button type="button" onClick={saveCustomerTab}>Save and Goto Reservation Tab &gt;&gt;</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reservation tab ──────────────────────────────────────────── */}
          <TabsContent value="reservation" forceMount className="data-[state=inactive]:hidden">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <p className="text-sm text-muted-foreground">Reservation Date : {legacyDate(initial?.createdAt ?? new Date(), { timeZone: o.locations.find((l) => l.id === str("locationId"))?.timeZone })}</p>
                <Card>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <F label="Reservation #" name="number"><Input id="number" value={initial?.number ? String(initial.number) : ""} placeholder="Auto" disabled /></F>
                    <F label="First Name" name="firstName" errorKey={cust("firstName")} required>
                      <div className="relative">
                        <Input {...bind("firstName")} autoComplete="off" className="pr-8" />
                        <button type="button" aria-label="Find customer" onClick={checkMatching} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"><SearchIcon className="size-4" /></button>
                      </div>
                    </F>
                    <F label="Middle Name" name="middleName"><Input {...bind("middleName")} autoComplete="off" /></F>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="lastName">Last Name<span className="text-destructive" aria-hidden>*</span></Label>
                        <button type="button" onClick={checkMatching} className="text-sm text-primary hover:underline">Check Matching</button>
                        {customerId && (
                          <Badge variant="success" className="ml-auto">
                            Existing customer
                            <button type="button" className="ml-1 underline" onClick={() => setCustomerId(null)}>unlink</button>
                          </Badge>
                        )}
                      </div>
                      <Input {...bind("lastName")} autoComplete="off" />
                      {errors[cust("lastName")] && <p className="text-xs text-destructive">{errors[cust("lastName")]![0]}</p>}
                    </div>
                    <F label="Email" name="email" errorKey={cust("email")}><Input type="email" {...bind("email")} /></F>
                    <F label="Phone" name="phone" errorKey={cust("phone")} required><Input type="tel" {...bind("phone")} /></F>
                    <div className="sm:col-span-2"><MatchList matches={customerId ? [] : matches.data} onUse={applyCustomer} /></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <F label="Location" name="locationId" required><NativeSelect {...bind("locationId")}>{opt(o.locations)}</NativeSelect></F>
                    <F label="Pickup Location" name="pickupLocationId" required><NativeSelect {...bind("pickupLocationId")}>{opt(o.locations)}</NativeSelect></F>
                    <F label="Return Location" name="returnLocationId"><NativeSelect {...bind("returnLocationId")}>{opt(o.locations)}</NativeSelect></F>
                    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                      <F label="Pickup Date" name="pickupAt" required><Input type="datetime-local" {...bind("pickupAt")} /></F>
                      <div className="space-y-1.5">
                        <Label htmlFor="xDays">X Days</Label>
                        <Input id="xDays" type="number" min={1} value={xDays} onChange={(e) => setXDays(Number(e.target.value))} />
                      </div>
                    </div>
                    <F label="Return Date" name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
                    <F label="Vehicle Type" name="vehicleTypeId" required>
                      <NativeSelect {...bind("vehicleTypeId")}><option value="">Please select</option>{opt(o.vehicleTypes)}</NativeSelect>
                    </F>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="companyId">Company</Label>
                        {str("companyId") && <button type="button" className="text-sm text-primary hover:underline" onClick={() => set("companyId", "")}>Clear</button>}
                      </div>
                      <CompanySearch companies={o.companies} value={str("companyId")} onChange={(id) => set("companyId", id)} />
                      {company?.isUndesired && <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangleIcon className="size-3.5" /> {company.name} is on the undesired list.</p>}
                    </div>
                    <F label="Rate" name="rateId" required>
                      <NativeSelect {...bind("rateId")}>
                        <option value="" />
                        {rates.map((r) => <option key={r.id} value={r.id}>{r.code}{r.daily ? ` (${money(r.daily)})` : ""}</option>)}
                      </NativeSelect>
                    </F>
                    <F label="Vehicle" name="vehicleId">
                      <SearchPicker id="vehicleId" items={vehicles} value={str("vehicleId")} onChange={(id) => set("vehicleId", id)} disabled={!validWindow || !str("vehicleTypeId")} emptyText="No free vehicle of this type for these dates" />
                    </F>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <DiscountField bind={bind} label="Discount" noBlank error={errors.discountValue?.[0]} />
                      <F label="Reason" name="discountReasonId"><NativeSelect {...bind("discountReasonId")}><option value="" />{opt(o.discountReasons)}</NativeSelect></F>
                    </div>
                    <F label="Deposit:" name="deposit"><Input type="number" min={0} step="0.01" {...bind("deposit")} /></F>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <F label="Delivery Address" name="deliveryAddress"><Input {...bind("deliveryAddress")} placeholder="Enter a location" /></F>
                    <F label="Referral" name="referralId"><ReferralField referrals={o.referrals} value={str("referralId")} onChange={(id) => set("referralId", id)} /></F>
                    <F label="Driver" name="driver"><NativeSelect id="driver" value="" onChange={() => {}}><option value="" /></NativeSelect></F>
                    <F label="Airline" name="airline"><Input {...bind("airline")} /></F>
                    <F label="Flight #" name="flightNumber"><Input {...bind("flightNumber")} /></F>
                    <F label="Hotel" name="hotel"><Input {...bind("hotel")} /></F>
                    <F label="Arrival Aiport" name="arrivalAirport"><Input {...bind("arrivalAirport")} /></F>
                    <F label="Prefered Language" name="preferredLanguage">
                      <NativeSelect {...bind("preferredLanguage")}><option value="" />{str("preferredLanguage") && <option>{str("preferredLanguage")}</option>}</NativeSelect>
                    </F>
                    <F label="PO#" name="poNumber"><Input {...bind("poNumber")} /></F>
                    <F label="RO#" name="roNumber"><Input {...bind("roNumber")} /></F>
                    <F label="Customer Notes" name="customerNotes"><Textarea rows={3} {...bind("customerNotes")} /></F>
                    <F label={editing ? "Add Memo" : "Memo"} name="memo"><Textarea rows={3} {...bind("memo")} /></F>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.memoShowAsPopup === true} onChange={(e) => set("memoShowAsPopup", e.target.checked)} /> Always display this memo as a popup for system users</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.isNonRevenue === true} onChange={(e) => set("isNonRevenue", e.target.checked)} /> Non-Revenue</label>
                  </CardContent>
                </Card>

                <OptionsGrid data={bo.data} value={opts} onChange={setOpts} applyDefaults={!editing} paymentDetails={o.paymentDetails} />

                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    {STATUSES.map(([value, label]) => {
                      const settable = value === "CONFIRMED" || value === "TENTATIVE" || (value === "CANCELLED" && editing);
                      return (
                        <label key={value} className="flex items-center gap-2">
                          <Checkbox checked={str("status") === value} disabled={!settable} onChange={(e) => e.target.checked && set("status", value)} /> {label}
                        </label>
                      );
                    })}
                    <label className="flex items-center gap-2"><Checkbox checked={v.sendConfirmationEmail === true} onChange={(e) => set("sendConfirmationEmail", e.target.checked)} /> Send Confirmation Email</label>
                    <label className="flex items-center gap-2"><Checkbox checked={v.isLoaner === true} onChange={(e) => set("isLoaner", e.target.checked)} /> Is Loaner</label>
                  </div>
                  <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Save</Button>
                </div>
              </div>

              {/* ── right: charges + Payment Information ─────────────────────── */}
              <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
                <Button type="button" variant="ghost" className="text-primary" onClick={() => { setPreviewOn(true); void preview.refetch(); }}>
                  <RefreshCwIcon /> Update Charges Summary
                </Button>
                <ChargeSummary title="Charges" preview={previewOn ? preview.data : undefined} emptyText="Choose dates, location, vehicle type and rate, then Update Charges Summary." />
                <Card className="gap-3">
                  <CardHeader><CardTitle>Payment Information</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ccSwipe">Swipe Credit Card Here Or</Label><Input id="ccSwipe" className="max-w-24" autoComplete="off" /></div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1"><Label htmlFor="cc">Credit Card</Label><PlusCircleIcon className="size-3.5 text-primary" aria-hidden /></div>
                      <NativeSelect id="cc" value="" onChange={() => {}}><option value="" /></NativeSelect>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="cvv">CVV</Label><Input id="cvv" inputMode="numeric" maxLength={4} autoComplete="off" /></div>
                    <F label="Payment Method" name="payMethod" required><NativeSelect {...bind("payMethod")}><option value="">Please select</option>{PAYMENT_METHOD_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</NativeSelect></F>
                    <F label="Amount" name="payAmount" required><Input type="number" min={0.01} step="0.01" {...bind("payAmount")} /></F>
                    <F label="Transaction Type" name="payType">
                      <NativeSelect {...bind("payType")}><option value="PAYMENT">Payment (Credit)</option><option value="AUTHORIZATION">Authorization</option><option value="REFUND">Refund</option></NativeSelect>
                    </F>
                    <div className="grid grid-cols-2 gap-2">
                      <F label="Authorization Code" name="payAuth"><Input {...bind("payAuth")} /></F>
                      <F label="Transaction Code" name="payTxn"><Input {...bind("payTxn")} /></F>
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="button" className="w-full sm:w-1/2" onClick={submitPayment}>Submit</Button>
                      {paymentReady && !editing && <p className="mt-1 text-xs text-muted-foreground">Payment of {money(Number(str("payAmount")))} will be applied when the reservation is saved.</p>}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </TabsContent>
        </Tabs>
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

type Match = {
  id: string; firstName: string; middleName: string | null; lastName: string; phone: string | null; email: string | null;
  licenseNumber: string | null; birthDate: Date | string | null; isUndesired: boolean; isActive: boolean;
};

/** "Check Matching" results: existing customers to use instead of creating a duplicate. */
function MatchList<T extends Match>({ matches, onUse }: { matches: T[] | undefined; onUse: (c: T) => void }) {
  if (!matches?.length) return null;
  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <UsersIcon className="size-4" /> {matches.length} matching customer{matches.length > 1 ? "s" : ""}
      </p>
      <ul className="divide-y rounded-md border bg-card text-sm">
        {matches.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
            <span>
              <span className="font-medium">{[c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ")}</span>{" "}
              <span className="text-muted-foreground">{[c.phone, c.email, c.licenseNumber && `Lic ${c.licenseNumber}`, c.birthDate && `DOB ${date(c.birthDate)}`].filter(Boolean).join(" · ")}</span>{" "}
              {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
              {!c.isActive && <Badge variant="muted">Inactive</Badge>}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => onUse(c)}>Use this customer</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
