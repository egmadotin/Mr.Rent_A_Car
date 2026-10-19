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
import { money } from "@mrac/ui/lib/format";
import { DiscountField, FormAlert, bookingWindow, initialBookingTimes } from "../../../../_components/booking-kit";
import { CompanySearch } from "../../../../_components/company-search";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../_components/form";
import { OptionsGrid, emptyOptions, useBookingOptions, type BookingOptions } from "../../../../_components/options-grid";
import { ReferralField } from "../../../../_components/referral-field";
import { RateDetailsButton } from "../../../../_components/rate-details";

type Values = Record<string, string>;
export type QuoteFormInitial = { quoteId?: string; values: Values; options?: BookingOptions; customerLabel?: string };

/**
 * Add/Edit Quote — exactly the fields of RentCentric QuotesModify.aspx, in its order:
 * Pickup Date*, Return Date*, Pickup Location*, Return Location*, Company (search), Vehicle Type*, Rate*,
 * Discount % (blank / % / $ + value), Referral (+ Quick Referral Add), the Option Name / Type / Rate grid,
 * Add/Edit Other Charges, Generate. The customer's name / email / phone are entered on Email / SMS Quote,
 * as in RentCentric; an existing contact is kept when editing.
 */
export function QuoteForm({ initial, defaultLocationId }: { initial?: QuoteFormInitial; defaultLocationId?: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const editing = !!initial?.quoteId;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      // the contact is maintained by Email / SMS Quote; editing keeps what is there
      customerId: v.customerId || null,
      firstName: v.firstName ?? "",
      lastName: v.lastName ?? "",
      email: v.email ?? "",
      contactPhone: v.contactPhone ?? "",
      options: opts,
    };
    try {
      const res = editing
        ? await client.staff.quote.update.mutate({ quoteId: initial!.quoteId!, data: data as never })
        : await client.staff.quote.create.mutate(data as never);
      toast.success(editing ? "Quote updated" : "Quote saved");
      router.push(`/admin/quotes/${res.id}`);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, val]) => [k.replace(/^data\./, ""), val])));
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

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6 p-4 md:p-6">
        <FormAlert message={formError} />
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <F label="Pickup Date" name="pickupAt" required><Input type="datetime-local" {...bind("pickupAt")} /></F>
            <F label="Return Date" name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
            <F label="Pickup Location" name="pickupLocationId" required><NativeSelect {...bind("pickupLocationId")}>{opt(o.locations)}</NativeSelect></F>
            <F label="Return Location" name="returnLocationId" required><NativeSelect {...bind("returnLocationId")}>{opt(o.locations)}</NativeSelect></F>
            <F label="Company" name="companyId"><CompanySearch companies={o.companies} value={v.companyId ?? ""} onChange={(id) => set("companyId", id)} /></F>
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

        <OptionsGrid data={bo.data} value={opts} onChange={setOpts} applyDefaults={!editing} paymentDetails={o.paymentDetails} />

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Generate
          </Button>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}
