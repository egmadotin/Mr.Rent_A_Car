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
import { BookingSummaryBar, StepHeader, StepNav, StepPanel, shortWhen, type Step } from "../../../../_components/booking-steps";
import { money } from "@mrac/ui/lib/format";
import { DiscountField, FormAlert, bookingWindow, initialBookingTimes } from "../../../../_components/booking-kit";
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
  // steps (client request): 1 Customer, 2 Trip & vehicle, 3 Extras & charges; editing opens on the extras
  const [step, setStep] = React.useState(initial?.quoteId ? 2 : 0);
  const [reached, setReached] = React.useState(initial?.quoteId ? 2 : 0);
  function go(i: number) {
    setStep(i);
    setReached((x) => Math.max(x, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
  // changing location / type / date resets the rate if it no longer applies
  React.useEffect(() => {
    if (bo.data && v.rateId && !bo.data.rates.some((r) => r.id === v.rateId)) set("rateId", "");
  }, [bo.data, v.rateId]);

  /** Next: the trip step needs its required fields (the customer is optional on a quote). */
  function next(from: number) {
    if (from === 1) {
      const missing = ([["pickupLocationId", "Pickup Location"], ["returnLocationId", "Return Location"], ["pickupAt", "Pickup Date"], ["returnAt", "Return Date"], ["vehicleTypeId", "Vehicle Type"], ["rateId", "Rate"]] as [string, string][]).filter(([k]) => !v[k]);
      if (missing.length) {
        setErrors(Object.fromEntries(missing.map(([k, l]) => [k, [`${l} is required`]])));
        toast.error("Fill in the highlighted fields.");
        return;
      }
    }
    setErrors({});
    go(from + 1);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step !== 2) return;
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
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-4 md:p-6">
        <StepHeader steps={STEPS} current={step} reached={reached} onGo={go} />
        <BookingSummaryBar
          customer={[v.firstName, v.lastName].filter(Boolean).join(" ")}
          from={shortWhen(v.pickupAt ?? "")}
          to={shortWhen(v.returnAt ?? "")}
          vehicle={vt}
          days={days}
          total={generated.data ? Number(generated.data.total) : null}
        />
        <FormAlert message={formError} />

        {/* ── 1 · Customer (optional on a quote) ───────────────────────── */}
        <StepPanel active={step === 0}>
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
          <StepNav onNext={() => next(0)} nextLabel="Next: trip & vehicle" />
        </StepPanel>

        {/* ── 2 · Trip & vehicle ───────────────────────────────────────── */}
        <StepPanel active={step === 1}>
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
          <StepNav onBack={() => go(0)} onNext={() => next(1)} nextLabel="Next: extras & charges" />
        </StepPanel>

        {/* ── 3 · Extras & charges: Generate stays here, Save opens the quote ── */}
        <StepPanel active={step === 2}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <OptionsGrid data={bo.data} value={opts} onChange={setOpts} applyDefaults={!initial?.quoteId} paymentDetails={o.paymentDetails} />
            <div>
              {generated.data
                ? <GeneratedCharges number={generated.data.quote.number} lines={generated.data.quote.chargeLines} total={Number(generated.data.total)} updating={generated.isFetching} />
                : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Choose the options, then Generate to see the charges here.</p>}
            </div>
          </div>
          <StepNav
            onBack={() => go(1)}
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

/** The quote's charges after Generate (same lines as the quote page), so options can be changed and generated again. */
function GeneratedCharges({ number, lines, total, updating }: { updating?: boolean; number: number; lines: { id: string; kind: string; name: string; units: unknown; rate: unknown; total: unknown }[]; total: number }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">Quote #{number} — charges{updating && <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Loader2Icon className="size-3 animate-spin" /> Updating…</span>}</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="py-1 font-medium">Charge</th><th className="py-1 text-right font-medium">Unit</th><th className="py-1 text-right font-medium">Rate</th><th className="py-1 text-right font-medium">Total</th></tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1.5">{l.name}</td>
                {/* a tax line's rate is its percentage, so only its amount is shown */}
                <td className="py-1.5 text-right tabular-nums">{l.kind === "TAX" ? "" : Number(l.units)}</td>
                <td className="py-1.5 text-right tabular-nums">{l.kind === "TAX" ? "" : money(Number(l.rate))}</td>
                <td className="py-1.5 text-right tabular-nums">{money(Number(l.total))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t font-semibold"><td className="py-2" colSpan={3}>Total</td><td className="py-2 text-right tabular-nums">{money(total)}</td></tr></tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
