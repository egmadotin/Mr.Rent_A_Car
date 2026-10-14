"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mrac/ui/components/tabs";
import { toast } from "@mrac/ui/components/sonner";
import { CheckField, Field, FormErrorsContext, SelectField, TextareaField, errorMessage, fieldErrorsOf, formToObject } from "../../../../_components/form";

type Kind = "misc" | "insurance";
type Values = Record<string, unknown>;

const CALC = [
  { value: "HOUR_24", label: "24 Hour Time" },
  { value: "CALENDAR_DAY", label: "Calender Day" },
  { value: "FLAT", label: "Flat" },
];

const iso = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : "");
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * Add/Edit Misc.Charge (MiscChargesModify.aspx) and Insurance Coverage (InsurancesModify.aspx).
 * Same Basic / Advanced tab split as the legacy forms, every field kept.
 */
export function ChargeForm({ kind, id, initial }: { kind: Kind; id?: string; initial?: Values }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const lookups = useQuery(trpc.staff.settings.lookups.queryOptions()).data;
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [allTypes, setAllTypes] = React.useState(initial ? initial.allVehicleTypes !== false : true);
  const v = initial ?? {};
  const selectedTypes = new Set(((v.vehicleTypes as { vehicleTypeId: string }[] | undefined) ?? []).map((t) => t.vehicleTypeId));
  const isMisc = kind === "misc";
  const base = isMisc ? "/admin/settings/misc-charges" : "/admin/settings/insurances";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    const data = formToObject(e.currentTarget) as Values;
    data.vehicleTypeIds = (data.vehicleTypeIds as string[] | undefined) ?? [];
    try {
      const res = isMisc
        ? await client.staff.settings.miscSave.mutate({ id, data: data as never })
        : await client.staff.settings.insuranceSave.mutate({ id, data: data as never });
      toast.success("Saved");
      router.push(`${base}/${res.id}`);
      router.refresh();
    } catch (err) {
      const fe = fieldErrorsOf(err);
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, val]) => [k.replace(/^data\./, ""), val])));
      setFormError(Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (!lookups) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-4 md:p-6">
        {formError && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon className="size-4" /> {formError}
          </div>
        )}
        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          {/* forceMount keeps both tabs' inputs in the form */}
          <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Name" name="name" required defaultValue={s(v.name)} />
                <Field label="Code" name="code" required defaultValue={s(v.code)} />
                <SelectField
                  label="Location"
                  name="locationId"
                  options={lookups.locations.map((l) => ({ value: l.id, label: l.isActive ? l.name : `${l.name} (inactive)` }))}
                  placeholder="All locations"
                  defaultValue={s(v.locationId)}
                />
                <SelectField
                  label="Calculation by"
                  name="calculationBy"
                  required
                  placeholder={false}
                  options={isMisc ? [{ value: "PERCENT", label: "Percentage" }, ...CALC] : CALC}
                  defaultValue={s(v.calculationBy) || "HOUR_24"}
                />
                <Field
                  label={isMisc ? "Rate (daily, flat amount or %)" : "Daily rate"}
                  name={isMisc ? "rate" : "dailyRate"}
                  type="number"
                  step="0.01"
                  required
                  defaultValue={s(isMisc ? v.rate : v.dailyRate)}
                />
                <Field label="Weekly" name="weeklyRate" type="number" step="0.01" defaultValue={s(v.weeklyRate)} />
                <Field label="Monthly" name="monthlyRate" type="number" step="0.01" defaultValue={s(v.monthlyRate)} />
                <div className="space-y-2 sm:col-span-2 xl:col-span-3">
                  <CheckField label="All vehicle types" name="allVehicleTypes" checked={allTypes} onChange={(e) => setAllTypes(e.target.checked)} />
                  {!allTypes && (
                    <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {lookups.vehicleTypes.map((t) => (
                        <CheckField key={t.id} label={t.name} name="vehicleTypeIds" value={t.id} data-multi="1" defaultChecked={selectedTypes.has(t.id)} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2 xl:col-span-3">
                  <CheckField label="Display online" name="displayOnline" defaultChecked={v.displayOnline === true} />
                  <CheckField label="Rentcars.com" name="rentcarsCom" defaultChecked={v.rentcarsCom === true} />
                  <CheckField label="Default Rentcars.com" name="defaultRentcarsCom" defaultChecked={v.defaultRentcarsCom === true} />
                  {isMisc && <CheckField label="Mandatory" name="isMandatory" defaultChecked={v.isMandatory === true} />}
                  <CheckField label="Active" name="isActive" defaultChecked={v.isActive !== false} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" forceMount className="data-[state=inactive]:hidden">
            <Card>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Hourly" name="hourlyRate" type="number" step="0.01" defaultValue={s(v.hourlyRate)} />
                <Field label="Extra daily" name="extraDailyRate" type="number" step="0.01" defaultValue={s(v.extraDailyRate)} />
                {!isMisc && <Field label="Deductible" name="deductible" type="number" step="0.01" defaultValue={s(v.deductible)} />}
                <Field label="Grace minutes" name="graceMinutes" type="number" min={0} defaultValue={s(v.graceMinutes ?? 0)} />
                {isMisc && <Field label="Km included" name="milesIncluded" type="number" min={0} defaultValue={s(v.milesIncluded ?? 0)} />}
                <Field label="Effective date" name="effectiveDate" type="date" defaultValue={iso(v.effectiveDate)} />
                <Field label="End date" name="endDate" type="date" defaultValue={iso(v.endDate)} />
                <Field label="Min days" name="minDays" type="number" min={0} defaultValue={s(v.minDays ?? 0)} />
                <Field label="Max days" name="maxDays" type="number" min={0} defaultValue={s(v.maxDays ?? 0)} hint="0 = no limit" />
                <Field label="Group" name="group" defaultValue={s(v.group)} hint={isMisc ? "e.g. under age, OOP, Snow Tire — only one per group" : "e.g. ODW"} />
                <TextareaField label="Description (shown online under “Details”)" name="description" rows={6} defaultValue={s(v.description)} className="sm:col-span-2 xl:col-span-3" />
                <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
                  <CheckField label="Value pricing" name="valuePricing" defaultChecked={v.valuePricing === true} />
                  {isMisc ? (
                    <>
                      <CheckField label="Default misc charge (added to every booking)" name="isDefault" defaultChecked={v.isDefault === true} />
                      <CheckField label="Driver is underage" name="autoWhenUnderAge" defaultChecked={v.autoWhenUnderAge === true} />
                      <CheckField label="Additional driver is added" name="autoWhenAdditionalDriver" defaultChecked={v.autoWhenAdditionalDriver === true} />
                      <CheckField label="Prepaid fuel charge" name="isPrepaidFuel" defaultChecked={v.isPrepaidFuel === true} />
                      <CheckField label="Enable multi selection online" name="multiSelectOnline" defaultChecked={v.multiSelectOnline === true} />
                      <CheckField label="No show charge" name="isNoShowCharge" defaultChecked={v.isNoShowCharge === true} />
                      <CheckField label="Display at start rental" name="displayAtStartRental" defaultChecked={v.displayAtStartRental !== false} />
                      <CheckField label="Display at end rental" name="displayAtEndRental" defaultChecked={v.displayAtEndRental !== false} />
                      <CheckField label="Toll admin fee waiver" name="tollAdminFeeWaiver" defaultChecked={v.tollAdminFeeWaiver === true} />
                    </>
                  ) : (
                    <>
                      <CheckField label="Deposit" name="isDeposit" defaultChecked={v.isDeposit === true} />
                      <CheckField label="Default insurance (pre-selected)" name="isDefault" defaultChecked={v.isDefault === true} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href={base}>Cancel</Link></Button>
          <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />} Save</Button>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}

/** Small header card used above settings lists. */
export function SettingsIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-1">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
