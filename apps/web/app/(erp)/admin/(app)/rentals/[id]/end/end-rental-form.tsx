"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { fromDateTimeLocal, toDateTimeLocal } from "@mrac/ui/lib/format";
import { ChargeSummary, FormAlert } from "../../../../../_components/booking-kit";
import { PaymentInfoCard } from "../../../../../_components/booking-customer";
import { FieldShell as F, FormErrorsContext, errorMessage, fieldErrorsOf } from "../../../../../_components/form";
import { legacyDate } from "../../../../../_components/list-kit";
import { PageHeader } from "../../../../../_components/page-header";
import { PrintoutSelect } from "../../../../../_components/printout-select";
import { FuelSlider, rentalFields, type Values } from "../../new/start-rental-form";
import { rentalFormInitial } from "../../_lib/rental-form-values";
import { ChargeTable } from "../_components/charges-tab";
import type { RentalData } from "../_components/use-rental";

/**
 * End Rental (CheckIn2.aspx): Pickup Date; Expected Return Date*, Return Date*; Pickup Location, Return Location;
 * vehicle; Odometer Out*, Odometer In*; Fuel Out / Fuel In; View Rates & Charges, Damage; Payment Information; on the
 * right Update Charges Summary + the charge table with payments and Balance; Rental Printout + End Rental.
 * Saves through rental.update (close) so the charges are re-priced to the actual return.
 */
export function EndRentalForm({ rentalId }: { rentalId: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const q = useQuery(trpc.staff.rental.byId.queryOptions({ rentalId }));
  const data = q.data as RentalData | undefined;
  const locations = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data?.locations;
  const [v, setV] = React.useState<Values | null>(null);
  const [opts, setOpts] = React.useState<ReturnType<typeof rentalFormInitial>["options"] | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [previewOn, setPreviewOn] = React.useState(false);

  React.useEffect(() => {
    if (!data || v) return;
    const init = rentalFormInitial(data.rental, { ending: true });
    const zone = data.rental.checkOutLocation.timeZone;
    setOpts(init.options);
    setV({
      ...init.values,
      returnAt: toDateTimeLocal(init.values.returnAt as string, zone),
      checkedInAt: toDateTimeLocal(init.values.checkedInAt as string, zone),
      // RentCentric pre-fills Odometer In with Odometer Out
      odometerIn: (init.values.odometerOut as string) ?? "",
      payType: "AUTHORIZATION",
      payAmount: Number(data.totals.balance) > 0 ? Number(data.totals.balance).toFixed(2) : "",
    });
  }, [data, v]);

  const r = data?.rental;
  const tz = r?.checkOutLocation.timeZone;
  const str = (k: string) => (v && typeof v[k] === "string" ? (v[k] as string) : "");
  const set = (k: string, val: string) => setV((s) => (s ? { ...s, [k]: val } : s));
  const setPrintout = React.useCallback((name: string) => setV((s) => (s ? { ...s, printout: name } : s)), []);
  const bind = (k: string) => ({
    id: k,
    name: k,
    value: str(k),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value),
    "aria-invalid": errors[k] ? (true as const) : undefined,
  });

  const checkedInAt = str("checkedInAt") ? fromDateTimeLocal(str("checkedInAt"), tz) : null;
  const preview = useQuery({
    ...trpc.staff.booking.preview.queryOptions({
      pickupAt: r ? new Date(r.checkOutAt) : new Date(),
      returnAt: checkedInAt ?? new Date(),
      locationId: r?.checkOutLocationId ?? "",
      returnLocationId: str("returnLocationId") || null,
      vehicleTypeId: r?.vehicleTypeId ?? "",
      rateId: r?.rateId ?? null,
      discountType: (r?.discountType ?? null) as "PERCENT" | null,
      discountValue: r?.discountValue ? Number(r.discountValue) : null,
      options: opts ?? { insuranceIds: [], miscCharges: [], excludedTaxIds: [], otherCharges: [] },
    }),
    enabled: previewOn && !!r && !!checkedInAt && !!opts,
    placeholderData: (p) => p,
  });

  if (q.error) return <p className="p-6 text-sm text-destructive">{q.error.message}</p>;
  if (!data || !r || !v || !opts) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (r.status !== "OPEN")
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Rental #{r.raNumber} is not open. <Link className="text-primary underline" href={`/admin/rentals/${r.id}`}>Back to the rental</Link>
      </p>
    );

  async function end(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      await client.staff.rental.update.mutate({
        ...rentalFields(v!, opts!, { pickupAt: new Date(r!.checkOutAt), returnAt: fromDateTimeLocal(str("returnAt"), tz) }),
        rentalId: r!.id,
        checkedInAt,
        odometerIn: str("odometerIn") || null,
        fuelIn: Number(str("fuelIn") || 0),
        fuelCharge: str("fuelCharge") || null,
        upgradeType: (str("upgradeType") || null) as "FLAT" | null,
        upgradeAmount: str("upgradeAmount") || null,
        close: true,
      } as never);
      toast.success("Rental ended");
      router.push(`/admin/rentals/${r!.id}?print=${encodeURIComponent(str("printout"))}`);
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function submitPayment() {
    if (!str("payMethod") || !(Number(str("payAmount")) > 0)) {
      setErrors({ payMethod: str("payMethod") ? undefined : ["Payment Method is required"], payAmount: Number(str("payAmount")) > 0 ? undefined : ["Amount is required"] });
      return;
    }
    try {
      await client.staff.rental.addPayment.mutate({
        rentalId: r!.id,
        method: str("payMethod") as "CASH",
        transactionType: (str("payType") || "AUTHORIZATION") as "AUTHORIZATION",
        amount: Number(str("payAmount")),
        authorizationCode: str("payAuth"),
        transactionCode: str("payTxn"),
        takenAt: new Date(),
      });
      toast.success("Payment applied");
      await q.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <FormErrorsContext.Provider value={errors}>
      <PageHeader
        title="End Rental"
        breadcrumbs={[
          { label: "Customers Utility", href: "/admin/customers" },
          { label: `${r.customer.firstName} ${r.customer.lastName}`, href: `/admin/customers/${r.customerId}` },
          { label: "Rentals", href: "/admin/rentals" },
          { label: `Rental# ${r.raNumber}`, href: `/admin/rentals/${r.id}` },
        ]}
      />
      <form onSubmit={end} noValidate className="grid gap-6 p-4 md:p-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <FormAlert message={formError} />
          <p className="text-sm">Pickup Date: {legacyDate(r.checkOutAt, { timeZone: tz })}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Expected Return Date" name="returnAt" required><Input type="datetime-local" {...bind("returnAt")} /></F>
            <F label="Return Date" name="checkedInAt" required><Input type="datetime-local" {...bind("checkedInAt")} /></F>
            <div className="space-y-1.5"><Label>Pickup Location:</Label><Input value={r.checkOutLocation.name} disabled /></div>
            <F label="Return Location" name="checkInLocationId">
              <NativeSelect {...bind("returnLocationId")} id="checkInLocationId">
                <option value="">Please Select</option>
                {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </F>
            <p className="text-sm sm:col-span-2">Vehicle ({r.vehicle.year ?? ""} {r.vehicle.make.name} {r.vehicle.model.name} ({r.vehicle.assignedId}))</p>
            <F label="Odometer Out" name="odometerOut" required><Input type="number" min={0} {...bind("odometerOut")} /></F>
            <F label="Odometer In" name="odometerIn" required><Input type="number" min={0} {...bind("odometerIn")} /></F>
            <FuelSlider id="fuelOut" label="Fuel Out" value={str("fuelOut")} onChange={(x) => set("fuelOut", x)} />
            <FuelSlider id="fuelIn" label="Fuel In" value={str("fuelIn")} onChange={(x) => set("fuelIn", x)} />
            <Link href={`/admin/rentals/${r.id}/edit`} className="text-sm font-semibold text-primary hover:underline">View Rates &amp; Charges</Link>
            <span className="cursor-not-allowed text-sm font-semibold text-muted-foreground" title="Available once vehicle damage records are built">Damage</span>
            <p className="text-sm sm:col-span-2">Company : {r.company?.name ?? "Company Name"}</p>
          </div>
          <PaymentInfoCard
            locationId={r.checkOutLocationId}
            bind={bind}
            onSubmit={submitPayment}
            transactionTypes={[["AUTHORIZATION", "Authorization"], ["PAYMENT", "Payment (Credit)"], ["REFUND", "Refund -(Credit)"]]}
            codeLabels={["Auth Code", "Trans Code"]}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Button type="button" variant="ghost" className="text-primary" onClick={() => { setPreviewOn(true); void preview.refetch(); }}>
            <RefreshCwIcon /> Update Charges Summary
          </Button>
          {previewOn ? (
            <ChargeSummary title="Charges at this Return Date" preview={preview.data} emptyText="Enter the Return Date." />
          ) : (
            <Card className="py-0"><CardContent className="px-0"><ChargeTable data={data} /></CardContent></Card>
          )}
          <div className="flex flex-col items-end gap-3">
            <F label="Please Select Rental Printout" name="printout" required className="w-64">
              <PrintoutSelect locationId={r.checkOutLocationId} value={str("printout")} onChange={setPrintout} />
            </F>
            <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}End Rental</Button>
          </div>
        </aside>
      </form>
    </FormErrorsContext.Provider>
  );
}
