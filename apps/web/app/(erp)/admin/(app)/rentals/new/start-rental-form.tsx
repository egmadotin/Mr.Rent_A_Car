"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
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
import { money } from "@mrac/ui/lib/format";
import { ChargeSummary, DiscountField, FormAlert, bookingWindow, initialBookingTimes } from "../../../../_components/booking-kit";
import { CUSTOMER_FIELDS, CustomerFields, CustomerNotes, MatchList, PaymentInfoCard, customerValues, type CustomerLayout } from "../../../../_components/booking-customer";
import { CompanySearch } from "../../../../_components/company-search";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { OptionsGrid, emptyOptions, useBookingOptions, type BookingOptions } from "../../../../_components/options-grid";
import { ReferralField } from "../../../../_components/referral-field";
import { SearchPicker } from "../../../../_components/search-picker";

type Values = Record<string, string | boolean>;

/** CheckOut3.aspx Customer tab, in its order and wording. */
const RENTAL_CUSTOMER: CustomerLayout = [
  ["firstName", "First Name", true], ["middleName", "Middle Name"], ["lastName", "Last Name", true], ["address1", "Address 1"],
  ["address2", "Address 2"], ["city", "City"], ["postal", "Zip / Postal"], ["country", "Country"],
  ["province", "Province/State"], ["phone", "Phone", true], ["localPhone", "Local Phone"], ["email", "Email", true],
  ["companyPhone", "Employer Phone"], ["licenseNumber", "Driver's Lic. #", true], ["licenseProvince", "Lic.State", true], ["birthDate", "Date Of Birth", true],
  ["licenseExpiry", "Driver's License Expiration", true], ["insuranceCompany", "Insurance Company"], ["insurancePolicyNumber", "Policy Number"], ["insuranceExpiry", "Insurance Exp."],
  ["insurancePhone", "Insurance Phone"], ["insuranceFax", "Insurance Fax"],
];
const REQUIRED = RENTAL_CUSTOMER.flatMap((c) => (typeof c !== "number" && c[2] ? [c] : []));

/** "Please Select Rental Printout" — the agreement templates set up in RentCentric. */
export const RENTAL_PRINTOUTS = [
  "Bill Split Invoice", "Bill to Invoice Test", "Break Down", "Closing Test", "Closing Tests", "Customer Invoice", "Open Contract",
  "Open Contract-march 2017", "Standard",
];

export type StartRentalInitial = { values: Values };

/**
 * Start a Rental (CheckOut3.aspx?DoAction=New): a walk-in rental. Customer tab (renter profile, "Save And Goto Rental Tab"),
 * then the Rental tab — dates, vehicle out, odometer/fuel, the options grid, charges and Payment Information — finished
 * with "Complete And Print Rental".
 */
export function StartRentalForm({ initial, defaultLocationId, currentUserId }: { initial?: StartRentalInitial; defaultLocationId?: string; currentUserId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const { data: o } = useQuery(trpc.staff.reservation.formOptions.queryOptions());
  const { data: ro } = useQuery(trpc.staff.rental.formOptions.queryOptions());

  const [tab, setTab] = React.useState("customer");
  const [v, setV] = React.useState<Values>(() => ({
    country: "Canada",
    province: "British Columbia",
    licenseProvince: "British Columbia",
    discountType: "PERCENT",
    pickupLocationId: defaultLocationId ?? "",
    returnLocationId: defaultLocationId ?? "",
    fuelOut: "16",
    openedById: currentUserId,
    payType: "AUTHORIZATION",
    printout: "Open Contract",
    ...initial?.values,
    ...initialBookingTimes(initial?.values),
  }));
  const [opts, setOpts] = React.useState<BookingOptions>(emptyOptions());
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
    setV((s) => ({ ...s, pickupLocationId: s.pickupLocationId || first, returnLocationId: s.returnLocationId || first }));
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

  // "X Days" sets the return date from the pickup date
  const xDays = validWindow ? Math.max(1, Math.ceil((+returnAt! - +pickupAt!) / 86_400_000)) : "";
  function setXDays(n: number) {
    const p = str("pickupAt");
    if (!p || !(n > 0)) return;
    const d = new Date(`${p}:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    set("returnAt", d.toISOString().slice(0, 16));
  }

  const [previewOn, setPreviewOn] = React.useState(false);
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
    }),
    enabled: validWindow && !!str("vehicleTypeId") && !!str("pickupLocationId"),
  });

  const matches = useQuery({ ...trpc.staff.reservation.checkMatching.queryOptions(matchKey ?? {}), enabled: !!matchKey && !customerId });
  const checkMatching = () => setMatchKey({ firstName: str("firstName"), lastName: str("lastName"), phone: str("phone"), email: str("email"), licenseNumber: str("licenseNumber") });
  function applyCustomer(c: NonNullable<typeof matches.data>[number]) {
    setCustomerId(c.id);
    setV((s) => ({ ...s, ...customerValues(c) }));
    setMatchKey(null);
    if (c.isUndesired) toast.warning("This customer is on the undesired (do-not-rent) list.");
  }

  function customerMissing() {
    return REQUIRED.filter(([k]) => !str(k).trim());
  }
  function saveCustomerTab() {
    const missing = customerMissing();
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([k, label]) => [`customer.${k}`, [`${label} is required`]])));
      toast.error("Fix the highlighted fields.");
      return;
    }
    setErrors({});
    setTab("rental");
  }

  function pickVehicle(id: string) {
    set("vehicleId", id);
    const x = available.data?.find((a) => a.id === id);
    if (x) setV((s) => ({ ...s, vehicleId: id, odometerOut: String(x.currentOdometer ?? ""), fuelOut: String(x.fuelLevel ?? 16) }));
  }

  async function submit(allowUndesired = false) {
    const missing = customerMissing();
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map(([k, label]) => [`customer.${k}`, [`${label} is required`]])));
      setTab("customer");
      toast.error("Complete the Customer tab first.");
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    const pay = paymentReady && str("payMethod") && str("payAmount");
    try {
      const res = await client.staff.rental.startWalkIn.mutate({
        customerId: customerId ?? undefined,
        allowUndesired,
        customer: { ...Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, str(f)])), memo: str("customerMemo") } as never,
        checkOutLocationId: str("pickupLocationId"),
        checkInLocationId: str("returnLocationId"),
        checkOutAt: pickupAt as Date,
        returnAt: returnAt as Date,
        vehicleTypeId: str("vehicleTypeId"),
        vehicleId: str("vehicleId"),
        rateId: str("rateId"),
        companyId: str("companyId"),
        discountType: (str("discountValue") ? str("discountType") || null : null) as "PERCENT" | null,
        discountValue: str("discountValue") || null,
        discountReasonId: str("discountReasonId"),
        deposit: str("deposit") || null,
        odometerOut: str("odometerOut") as never,
        fuelOut: Number(str("fuelOut")),
        prepaidFuel: v.prepaidFuel === true,
        referralId: str("referralId"),
        claimNumber: str("claimNumber"),
        airport: str("airport"),
        airline: str("airline"),
        flightNumber: str("flightNumber"),
        poNumber: str("poNumber"),
        roNumber: str("roNumber"),
        rentalReasonId: str("rentalReasonId"),
        openedById: str("openedById"),
        memo: str("memo"),
        memoShowAsPopup: v.memoShowAsPopup === true,
        isNonRevenue: v.isNonRevenue === true,
        options: opts,
        // CVV is never stored
        payment: pay
          ? { method: str("payMethod") as "CASH", transactionType: (str("payType") || "AUTHORIZATION") as "AUTHORIZATION", amount: Number(str("payAmount")), authorizationCode: str("payAuth"), transactionCode: str("payTxn") }
          : null,
      });
      toast.success("Rental started");
      router.push(`/admin/rentals/${res.rentalId}?print=${encodeURIComponent(str("printout"))}`);
    } catch (err) {
      const msg = errorMessage(err);
      if (msg === "UNDESIRED_CUSTOMER") return setUndesired("customer");
      if (msg === "UNDESIRED_COMPANY") return setUndesired("company");
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      const m = Object.keys(fe).length ? "Fix the highlighted fields." : msg;
      setFormError(m);
      toast.error(m);
    } finally {
      setPending(false);
    }
  }

  function submitPayment() {
    if (!str("payMethod") || !(Number(str("payAmount")) > 0)) {
      setErrors({ payMethod: str("payMethod") ? undefined : ["Payment Method is required"], payAmount: Number(str("payAmount")) > 0 ? undefined : ["Amount is required"] });
      return;
    }
    setPaymentReady(true);
    toast.success("Payment will be applied when the rental is completed.");
  }

  if (!o || !ro) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>);
  const company = o.companies.find((c) => c.id === str("companyId"));
  const rates = bo.data?.rates ?? [];
  const vehicles = (available.data ?? []).map((x) => ({ id: x.id, label: `${x.assignedId} — ${x.year} ${x.make.name} ${x.model.name}` }));
  const fuel = Number(str("fuelOut") || 0);

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
            <TabsTrigger value="rental">Rental</TabsTrigger>
          </TabsList>

          {/* ── Customer tab ─────────────────────────────────────────────── */}
          <TabsContent value="customer" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Customer</CardTitle>
                {customerId && (
                  <Badge variant="success">
                    Existing customer
                    <button type="button" className="ml-1 underline" onClick={() => setCustomerId(null)}>unlink</button>
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-xs space-y-1.5"><Label htmlFor="swipe">Swipe</Label><Input id="swipe" autoComplete="off" /></div>
                <CustomerFields layout={RENTAL_CUSTOMER} bind={bind} onFind={checkMatching}><CustomerNotes bind={bind} /></CustomerFields>
                <MatchList matches={customerId ? [] : matches.data} onUse={applyCustomer} />
                <div className="flex justify-end">
                  <Button type="button" onClick={saveCustomerTab}>Save And Goto Rental Tab &gt;&gt;</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Rental tab ───────────────────────────────────────────────── */}
          <TabsContent value="rental" forceMount className="data-[state=inactive]:hidden">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <Card>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <F label="Rental #" name="raNumber" required><Input id="raNumber" value="" placeholder="Auto" disabled /></F>
                    <div className="hidden sm:block" />
                    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                      <F label="Pickup Date" name="checkOutAt" required><Input type="datetime-local" {...bind("pickupAt")} id="checkOutAt" /></F>
                      <div className="space-y-1.5">
                        <Label htmlFor="xDays">X Days</Label>
                        <Input id="xDays" type="number" min={1} value={xDays} onChange={(e) => setXDays(Number(e.target.value))} />
                      </div>
                    </div>
                    <F label="Return Date" name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
                    <F label="Pickup Location" name="checkOutLocationId" required><NativeSelect {...bind("pickupLocationId")} id="checkOutLocationId"><option value="">Please Select</option>{opt(o.locations)}</NativeSelect></F>
                    <F label="Return Location" name="checkInLocationId" required><NativeSelect {...bind("returnLocationId")} id="checkInLocationId"><option value="">Please Select</option>{opt(o.locations)}</NativeSelect></F>
                    <F label="Vehicle Type" name="vehicleTypeId" required>
                      <NativeSelect {...bind("vehicleTypeId")}><option value="">Please Select</option>{opt(o.vehicleTypes)}</NativeSelect>
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
                        <option value="">Please Select</option>
                        {rates.map((r) => <option key={r.id} value={r.id}>{r.code}{r.daily ? ` (${money(r.daily)})` : ""}</option>)}
                      </NativeSelect>
                    </F>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <DiscountField bind={bind} label="Discount" noBlank error={errors.discountValue?.[0]} />
                      <F label="Reason" name="discountReasonId"><NativeSelect {...bind("discountReasonId")}><option value="">None</option>{opt(o.discountReasons)}</NativeSelect></F>
                    </div>
                    <F label="Deposit:" name="deposit"><Input type="number" min={0} step="0.01" {...bind("deposit")} /></F>
                    <F label="Vehicle ID" name="vehicleId" required>
                      <SearchPicker id="vehicleId" items={vehicles} value={str("vehicleId")} onChange={pickVehicle} disabled={!validWindow || !str("vehicleTypeId")} emptyText="No free vehicle of this type for these dates" />
                    </F>
                    <F label="Odometer Out" name="odometerOut" required><Input type="number" min={0} step={1} {...bind("odometerOut")} /></F>
                    <label className="flex items-center gap-2 self-end text-sm sm:col-span-2">
                      <Checkbox checked={v.prepaidFuel === true} onChange={(e) => set("prepaidFuel", e.target.checked)} /> Buy Prepaid Fuel @ $2.00 Per Gallon
                    </label>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="fuelOut">Fuel Out<span className="text-destructive" aria-hidden>*</span> <span className="font-normal text-muted-foreground">{fuel}/16</span></Label>
                      <input id="fuelOut" type="range" min={0} max={16} step={1} value={fuel} onChange={(e) => set("fuelOut", e.target.value)} className="w-full accent-primary" />
                      <div className="flex justify-between text-xs text-muted-foreground"><span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <F label="Referral" name="referralId"><ReferralField referrals={o.referrals} value={str("referralId")} onChange={(id) => set("referralId", id)} /></F>
                    <F label="Claim#" name="claimNumber"><Input {...bind("claimNumber")} /></F>
                    <F label="AirPort" name="airport"><Input {...bind("airport")} /></F>
                    <F label="Airline" name="airline"><Input {...bind("airline")} /></F>
                    <F label="Flight #" name="flightNumber"><Input {...bind("flightNumber")} /></F>
                    <F label="PO#" name="poNumber"><Input {...bind("poNumber")} /></F>
                    <F label="RO#" name="roNumber"><Input {...bind("roNumber")} /></F>
                    <F label="Rental Reason" name="rentalReasonId"><NativeSelect {...bind("rentalReasonId")}><option value="">None</option>{opt(ro.rentalReasons)}</NativeSelect></F>
                    <F label="Opened By" name="openedById">
                      <NativeSelect {...bind("openedById")}><option value="">None</option>{ro.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect>
                    </F>
                    <F label="Memo" name="memo"><Textarea rows={3} {...bind("memo")} /></F>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.isNonRevenue === true} onChange={(e) => set("isNonRevenue", e.target.checked)} /> Non-Revenue</label>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={v.memoShowAsPopup === true} onChange={(e) => set("memoShowAsPopup", e.target.checked)} /> Always display this memo as a popup for system users</label>
                  </CardContent>
                </Card>

                <OptionsGrid data={bo.data} value={opts} onChange={setOpts} applyDefaults paymentDetails={o.paymentDetails} />
              </div>

              {/* ── right: charges + Payment Information ─────────────────────── */}
              <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
                <Button type="button" variant="ghost" className="text-primary" onClick={() => { setPreviewOn(true); void preview.refetch(); }}>
                  <RefreshCwIcon /> Update Charges Summary
                </Button>
                <ChargeSummary title="Charges" preview={previewOn ? preview.data : undefined} emptyText="Choose dates, location, vehicle type and rate, then Update Charges Summary." />
                <PaymentInfoCard
                  bind={bind}
                  onSubmit={submitPayment}
                  transactionTypes={[["AUTHORIZATION", "Authorization"], ["PAYMENT", "Payment (Credit)"], ["REFUND", "Refund -(Credit)"]]}
                  codeLabels={["Auth Code", "Trans Code"]}
                  pendingNote={paymentReady ? Number(str("payAmount")) : null}
                />
              </aside>
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-end gap-4 border-t pt-4">
              <F label="Please Select Rental Printout" name="printout" required className="w-64">
                <NativeSelect {...bind("printout")}>{RENTAL_PRINTOUTS.map((p) => <option key={p}>{p}</option>)}</NativeSelect>
              </F>
              <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Complete And Print Rental</Button>
            </div>
          </TabsContent>
        </Tabs>
      </form>

      <ConfirmAction
        open={undesired !== null}
        onOpenChange={(open) => !open && setUndesired(null)}
        destructive
        title={undesired === "company" ? "Undesired company" : "Undesired customer"}
        description={`This ${undesired} is on the undesired (do-not-rent) list. Start the rental anyway?`}
        confirmLabel="Start anyway"
        onConfirm={async () => {
          setUndesired(null);
          await submit(true);
        }}
      />
    </FormErrorsContext.Provider>
  );
}
