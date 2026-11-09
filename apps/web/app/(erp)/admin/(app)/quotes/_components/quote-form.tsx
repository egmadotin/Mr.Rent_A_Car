"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { BookingSummaryBar, BookingTopBar, StepNav, StepPanel, blockEnterSubmit, scrollToStep, shortWhen, type Step } from "../../../../_components/booking-steps";
import { money } from "@mrac/ui/lib/format";
import { DiscountField, EstimatePanel, FormAlert, bookingWindow, initialBookingTimes } from "../../../../_components/booking-kit";
import { CompanySearch } from "../../../../_components/company-search";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { OptionsGrid, emptyOptions, useBookingOptions, type BookingOptions } from "../../../../_components/options-grid";
import { ReferralField } from "../../../../_components/referral-field";
import { RateDetailsButton } from "../../../../_components/rate-details";

type Values = Record<string, string>;
const STEPS: Step[] = [
  { key: "customer", label: "Customer", hint: "Optional" },
  { key: "trip", label: "Trip & vehicle", hint: "Dates, vehicle, rate" },
  { key: "extras", label: "Extras & charges", hint: "Generate / Save" },
];
export type QuoteFormInitial = { quoteId?: string; values: Values; options?: BookingOptions; customerLabel?: string };

/**
 * Add/Edit Quote — exactly the fields of RentCentric QuotesModify.aspx, in its order:
 * Pickup Date*, Return Date*, Pickup Location*, Return Location*, Company (search), Vehicle Type*, Rate*,
 * Discount % (blank / % / $ + value), Referral (+ Quick Referral Add), the Option Name / Type / Rate grid,
 * Add/Edit Other Charges — plus the customer's First / Last Name, Email and Phone (client request: editable here, not
 * only on Email / SMS Quote). Two buttons: Generate saves and stays here with the charges shown (options still
 * editable, Generate again updates the same quote); Save saves and opens the quote.
 */
export function QuoteForm({ initial, defaultLocationId }: { initial?: QuoteFormInitial; defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  // the quote this form writes to: set by the first Generate on a new quote, then updated in place
  const [quoteId, setQuoteId] = React.useState(initial?.quoteId);
  const editing = !!quoteId;
  const generated = useQuery({ ...trpc.staff.quote.byId.queryOptions({ quoteId: quoteId ?? "" }), enabled: !!quoteId });
  const o = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data;
  const [v, setV] = React.useState<Values>(() => ({
    pickupLocationId: defaultLocationId ?? "",
    returnLocationId: defaultLocationId ?? "",
    ...initial?.values,
    ...initialBookingTimes(initial?.values),
  }));
  const [opts, setOpts] = React.useState<BookingOptions>(initial?.options ?? emptyOptions());
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  // one page (client request): every section visible; go() scrolls to one
  const go = (i: number) => scrollToStep(STEPS[i]?.key ?? "customer");

  React.useEffect(() => {
    if (!o) return;
    const first = o.locations[0]?.id ?? "";
    setV((s) => ({ ...s, pickupLocationId: s.pickupLocationId || first, returnLocationId: s.returnLocationId || first }));
  }, [o]);

  const set = (name: string, val: string) => setV((s) => ({ ...s, [name]: val }));
  const bind = (name: string) => ({
    id: name,
    name,
    value: v[name] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(name, e.target.value),
    "aria-invalid": errors[name] ? (true as const) : undefined,
  });

  const { pickupAt, returnAt } = bookingWindow(o?.locations, v.pickupLocationId ?? "", v.pickupAt ?? "", v.returnAt ?? "");
  const bo = useBookingOptions(v.pickupLocationId ?? "", v.vehicleTypeId ?? "", pickupAt, returnAt);
  // live estimate on the extras step (the same pricing as Generate, nothing saved)
  const preview = useQuery({
    ...trpc.staff.booking.preview.queryOptions({
      returnLocationId: v.returnLocationId || null,
      pickupAt: pickupAt ?? new Date(),
      returnAt: returnAt ?? new Date(),
      locationId: v.pickupLocationId ?? "",
      vehicleTypeId: v.vehicleTypeId ?? "",
      rateId: v.rateId || null,
      discountType: (v.discountValue ? v.discountType || null : null) as "PERCENT" | null,
      discountValue: v.discountValue ? Number(v.discountValue) : null,
      options: opts,
    }),
    enabled: !!pickupAt && !!returnAt && +returnAt > +pickupAt && !!v.vehicleTypeId && !!v.pickupLocationId && !!v.rateId,
    placeholderData: (p) => p,
  });
  // changing location / type / date resets the rate if it no longer applies
  React.useEffect(() => {
    if (bo.data && v.rateId && !bo.data.rates.some((r) => r.id === v.rateId)) set("rateId", "");
  }, [bo.data, v.rateId]);

  /** Required fields of a section (the customer is optional on a quote); shows the section when something is missing. */
  function checkSection(from: number): boolean {
    if (from === 1) {
      const missing = ([["pickupLocationId", "Pickup Location"], ["returnLocationId", "Return Location"], ["pickupAt", "Pickup Date"], ["returnAt", "Return Date"], ["vehicleTypeId", "Vehicle Type"], ["rateId", "Rate"]] as [string, string][]).filter(([k]) => !v[k]);
      if (missing.length) {
        setErrors(Object.fromEntries(missing.map(([k, l]) => [k, [`${l} is required`]])));
        toast.error("Fill in the highlighted fields.");
        go(from);
        return false;
      }
    }
    setErrors({});
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!checkSection(1)) return;
    const action = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "generate" ? "generate" : "save";
    setPending(true);
    setErrors({});
    setFormError(null);
    const data = {
      pickupAt: pickupAt as Date,
      returnAt: returnAt as Date,
      pickupLocationId: v.pickupLocationId ?? "",
      returnLocationId: v.returnLocationId ?? "",
      companyId: v.companyId || null,
      vehicleTypeId: v.vehicleTypeId ?? "",
      rateId: v.rateId ?? "",
      discountType: v.discountType || null,
      discountValue: v.discountValue ?? "",
      referralId: v.referralId || null,
      customerId: v.customerId || null,
      firstName: v.firstName ?? "",
      lastName: v.lastName ?? "",
      email: v.email ?? "",
      contactPhone: v.contactPhone ?? "",
      options: opts,
    };
    try {
      const res = editing
        ? await client.staff.quote.update.mutate({ quoteId: quoteId!, data: data as never })
        : await client.staff.quote.create.mutate(data as never);
      if (action === "save") {
        toast.success(editing ? "Quote saved" : "Quote created");
        router.push(`/admin/quotes/${res.id}`);
        return;
      }
      // Generate: stay on this form (now editing the generated quote) with its charges below
      if (!editing) {
        // the charges load once the new quote id is in place
        setQuoteId(res.id);
        window.history.replaceState(null, "", `/admin/quotes/${res.id}/edit`);
      } else await generated.refetch();
      toast.success("Quote generated");
    } catch (err) {
      const fe = fieldErrorsOf(err);
      const mapped = Object.fromEntries(Object.entries(fe).map(([k, val]) => [k.replace(/^data\./, ""), val]));
      setErrors(mapped);
      // show the step that holds the first problem
      const first = Object.keys(mapped)[0];
      if (first) go(["firstName", "lastName", "email", "contactPhone"].includes(first) ? 0 : first.startsWith("options") ? 2 : 1);
      const msg = Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  if (!o) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const opt = (xs: { id: string; name: string }[]) => xs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>);
  const rates = bo.data?.rates ?? [];

  const vt = o.vehicleTypes.find((x) => x.id === v.vehicleTypeId)?.name;
  const days = pickupAt && returnAt && +returnAt > +pickupAt ? Math.max(1, Math.ceil((+returnAt - +pickupAt) / 86_400_000)) : "";

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} onKeyDown={blockEnterSubmit} noValidate className="space-y-4 p-4 md:p-6">
        <BookingTopBar steps={STEPS}>
          <BookingSummaryBar
            customer={[v.firstName, v.lastName].filter(Boolean).join(" ")}
            from={shortWhen(v.pickupAt ?? "")}
            to={shortWhen(v.returnAt ?? "")}
            vehicle={vt}
            days={days}
            total={preview.data ? Number(preview.data.total) : generated.data ? Number(generated.data.total) : null}
          />
        </BookingTopBar>
        <FormAlert message={formError} />

        {/* ── 1 · Customer (optional on a quote) ───────────────────────── */}
        <StepPanel step={STEPS[0]!} n={1}>
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <p className="text-sm font-semibold sm:col-span-2">Customer information <span className="font-normal text-muted-foreground">— optional; also asked on Email / SMS Quote</span></p>
              <F label="First Name" name="firstName"><Input autoComplete="off" {...bind("firstName")} /></F>
              <F label="Last Name" name="lastName"><Input autoComplete="off" {...bind("lastName")} /></F>
              <F label="Email" name="email"><Input type="email" autoComplete="off" {...bind("email")} /></F>
              <F label="Phone" name="contactPhone"><Input type="tel" autoComplete="off" {...bind("contactPhone")} /></F>
              {initial?.customerLabel && <p className="text-xs text-muted-foreground sm:col-span-2">Linked customer: {initial.customerLabel}</p>}
            </CardContent>
          </Card>
        </StepPanel>

        {/* ── 2 · Trip & vehicle ───────────────────────────────────────── */}
        <StepPanel step={STEPS[1]!} n={2}>
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <F label="Pickup Location" name="pickupLocationId" required><NativeSelect {...bind("pickupLocationId")}>{opt(o.locations)}</NativeSelect></F>
              <F label="Return Location" name="returnLocationId" required><NativeSelect {...bind("returnLocationId")}>{opt(o.locations)}</NativeSelect></F>
              <F label="Company" name="companyId"><CompanySearch companies={o.companies} value={v.companyId ?? ""} onChange={(id) => set("companyId", id)} /></F>
              <F label="Pickup Date" name="pickupAt" required><Input type="datetime-local" {...bind("pickupAt")} /></F>
              <F label="Return Date" name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
              <F label="Vehicle Type" name="vehicleTypeId" required>
                <NativeSelect {...bind("vehicleTypeId")}><option value="">Please Select</option>{opt(o.vehicleTypes)}</NativeSelect>
              </F>
              <F label="Rate" name="rateId" required>
                <div className="flex items-center gap-1">
                  <NativeSelect {...bind("rateId")}>
                    <option value="">Please Select</option>
                    {rates.map((r) => <option key={r.id} value={r.id}>{r.code}{r.daily ? ` (${money(r.daily)})` : ""}</option>)}
                  </NativeSelect>
                  <RateDetailsButton rateValues={rates.find((r) => r.id === v.rateId)?.values} value={opts.rateOverride} onChange={(rateOverride) => setOpts((o) => ({ ...o, rateOverride }))} disabled={!v.rateId} />
                </div>
              </F>
              <DiscountField bind={bind} error={errors.discountValue?.[0]} />
              <F label="Referral" name="referralId"><ReferralField referrals={o.referrals} value={v.referralId ?? ""} onChange={(id) => set("referralId", id)} /></F>
            </CardContent>
          </Card>
        </StepPanel>

        {/* ── 3 · Extras & charges: Generate stays here, Save opens the quote ── */}
        <StepPanel step={STEPS[2]!} n={3}>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
            <OptionsGrid data={bo.data} value={opts} onChange={setOpts} applyDefaults={!initial?.quoteId} paymentDetails={o.paymentDetails} />
            <div className="xl:sticky xl:top-32">
              <EstimatePanel
                preview={preview.data}
                fetching={preview.isFetching}
                emptyText="Pricing the options…"
                badge={generated.data && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">Quote #{generated.data.quote.number} saved</span>}
              />
            </div>
          </div>
          <StepNav
            next={
              <div className="flex gap-2">
                <Button type="submit" name="action" value="generate" size="lg" variant="outline" disabled={pending}>
                  {pending && <Loader2Icon className="animate-spin" />}
                  Generate
                </Button>
                <Button type="submit" name="action" value="save" size="lg" disabled={pending}>Save</Button>
              </div>
            }
          />
        </StepPanel>
      </form>
    </FormErrorsContext.Provider>
  );
}
