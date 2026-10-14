"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { VEHICLE_STATUSES } from "@mrac/api/vehicle-status";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Label } from "@mrac/ui/components/label";
import { toast } from "@mrac/ui/components/sonner";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { cn } from "@mrac/ui/lib/utils";
import { FormAlert } from "../../../../_components/booking-kit";
import {
  CheckField,
  Field,
  FormErrorsContext,
  SelectField,
  TextareaField,
  errorMessage,
  fieldErrorsOf,
  formToObject,
} from "../../../../_components/form";

/** The five groups the spec calls out, plus GPS (manual until Moovetrax). */
const SECTIONS = [
  { id: "identity", title: "Identity & spec" },
  { id: "operations", title: "Operations" },
  { id: "compliance", title: "Maintenance, insurance & licensing" },
  { id: "mechanical", title: "Mechanical specs" },
  { id: "pricing", title: "Appearance & pricing" },
  { id: "gps", title: "GPS" },
] as const;

/** Which section each field lives in — used to flag sections that have errors. */
const FIELD_SECTION: Record<string, (typeof SECTIONS)[number]["id"]> = {
  assignedId: "identity", makeId: "identity", modelId: "identity", colour: "identity", vehicleTypeId: "identity", year: "identity", vin: "identity",
  rentalLocationId: "operations", owningLocationId: "operations", currentLocationId: "operations", tankSize: "operations",
  originalOdometer: "operations", currentOdometer: "operations",
  maintenanceEveryKm: "compliance", insuranceAmount: "compliance", inspectionAmount: "compliance", licenseNumber: "compliance", ldwMonthlyRate: "compliance",
  retailPriceHigh: "pricing", retailPriceLow: "pricing",
  gpsLatitude: "gps", gpsLongitude: "gps",
};

const opt = (xs: { id: string; name: string }[] | undefined) => (xs ?? []).map((x) => ({ value: x.id, label: x.name }));

export type VehicleFormInitial = { vehicleId: string; values: Record<string, string | boolean | string[]> };

/** Add Vehicle, or Edit Vehicle when `initial` is given (same fields, pre-filled). */
export function VehicleForm({ defaultLocationId, initial }: { defaultLocationId?: string; initial?: VehicleFormInitial }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const { data: o, isLoading } = useQuery(trpc.staff.vehicle.formOptions.queryOptions());
  const editing = !!initial;
  const iv = initial?.values ?? {};
  const dv = (name: string) => (typeof iv[name] === "string" ? (iv[name] as string) : undefined);
  const [makeId, setMakeId] = React.useState(dv("makeId") ?? "");
  const [fuelLevel, setFuelLevel] = React.useState(Number(dv("fuelLevel") ?? 16));
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const models = o?.makes.find((m) => m.id === makeId)?.models ?? [];
  const loc = o?.locations.some((l) => l.id === defaultLocationId) ? defaultLocationId : o?.locations[0]?.id;
  const sectionsWithErrors = new Set(Object.keys(errors).map((k) => FIELD_SECTION[k]).filter(Boolean));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    const v = formToObject(e.currentTarget);
    try {
      const { id } = editing
        ? await client.staff.vehicle.update.mutate({ vehicleId: initial.vehicleId, data: v as never })
        : await client.staff.vehicle.create.mutate(v as never);
      toast.success(editing ? `Vehicle ${v.assignedId} saved` : `Vehicle ${v.assignedId} added`);
      router.push(`/admin/vehicles/${id}`);
    } catch (err) {
      const fe = Object.fromEntries(Object.entries(fieldErrorsOf(err)).map(([k, val]) => [k.replace(/^data\./, ""), val]));
      setErrors(fe);
      const msg = Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(err);
      setFormError(msg);
      toast.error(msg);
      const first = Object.keys(fe)[0];
      if (first) document.getElementById(first)?.focus();
    } finally {
      setPending(false);
    }
  }

  if (isLoading || !o) return <div className="p-6 text-sm text-muted-foreground">Loading form…</div>;

  return (
    <FormErrorsContext.Provider value={errors}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6 p-4 md:p-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Section nav */}
        <nav aria-label="Form sections" className="hidden lg:block">
          <ol className="sticky top-6 space-y-1 text-sm">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    sectionsWithErrors.has(s.id) && "text-destructive",
                  )}
                >
                  <span className="grid size-5 place-items-center rounded-full border text-[11px]">{i + 1}</span>
                  {s.title}
                  {sectionsWithErrors.has(s.id) && <AlertCircleIcon className="ml-auto size-4" />}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          <FormAlert message={formError} />

          <FormSection id="identity" title="Identity & spec" description="What the vehicle is and how staff refer to it.">
            <Field label="Assigned ID" name="assignedId" defaultValue={dv("assignedId")} required hint="The unit number on the key tag." />
            <Field label="Vehicle name" name="name" defaultValue={dv("name")} />
            <SelectField label="Make" name="makeId" required options={opt(o.makes)} value={makeId} onChange={(e) => setMakeId(e.target.value)} />
            <SelectField
              label="Model"
              name="modelId"
              required
              key={makeId}
              defaultValue={makeId === dv("makeId") ? dv("modelId") : undefined}
              disabled={!makeId}
              options={opt(models)}
              placeholder={makeId ? (models.length ? "Please select" : "No models for this make yet") : "Choose a make first"}
            />
            <Field label="Model code" name="modelCode" defaultValue={dv("modelCode")} />
            <SelectField label="Year" name="year" defaultValue={dv("year")} options={Array.from({ length: 2029 - 1920 + 1 }, (_, i) => String(2029 - i))} placeholder="—" />
            <Field label="Colour" name="colour" defaultValue={dv("colour")} required />
            <SelectField label="Type" name="vehicleTypeId" defaultValue={dv("vehicleTypeId")} required options={opt(o.vehicleTypes)} />
            <SelectField label="Transmission" name="transmission" defaultValue={dv("transmission")} options={[{ value: "AUTOMATIC", label: "Automatic" }, { value: "MANUAL", label: "Manual" }, { value: "TIPTRONIC", label: "Tip Tronic" }, { value: "NONE", label: "None" }]} placeholder="—" />
            <SelectField label="Doors" name="doors" defaultValue={dv("doors")} options={["2", "3", "4", "5", "6"]} placeholder="—" />
            <SelectField label="Cylinders" name="cylinders" defaultValue={dv("cylinders")} options={["0", "1", "2", "3", "4", "6", "8", "10", "12"]} placeholder="—" />
            <Field label="VIN" name="vin" defaultValue={dv("vin")} maxLength={17} inputClassName="font-mono uppercase" />
            <Field label="Spot number" name="spotNumber" defaultValue={dv("spotNumber")} />
            <TextareaField label="Memo" name="memo" defaultValue={dv("memo")} rows={2} />
          </FormSection>

          <FormSection id="operations" title="Operations" description="Where it lives, its status, and fuel/odometer at intake.">
            <SelectField label="Rental location" name="rentalLocationId" required options={opt(o.locations)} defaultValue={dv("rentalLocationId") ?? loc} placeholder={false} />
            <SelectField label="Owning location" name="owningLocationId" required options={opt(o.locations)} defaultValue={dv("owningLocationId") ?? loc} placeholder={false} />
            <SelectField label="Current rental / offsite location" name="currentLocationId" required options={opt(o.locations)} defaultValue={dv("currentLocationId") ?? loc} placeholder={false} />
            <SelectField
              label="Current status"
              name="status"
              placeholder={false}
              defaultValue={dv("status") ?? "AVAILABLE"}
              options={VEHICLE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <SelectField label="Category" name="categoryId" defaultValue={dv("categoryId")} options={opt(o.categories)} placeholder="—" />
            <SelectField label="Body" name="bodyId" defaultValue={dv("bodyId")} options={opt(o.bodies)} placeholder="—" />
            <SelectField label="Fuel type" name="fuelTypeId" defaultValue={dv("fuelTypeId")} options={opt(o.fuelTypes)} placeholder="—" />
            <Field label="Tank size" name="tankSize" defaultValue={dv("tankSize")} type="number" min={0} max={205} required hint="Litres. Use 0 for electric." />
            <div className="space-y-1.5">
              <Label htmlFor="fuelLevel">Fuel level</Label>
              <div className="flex items-center gap-3">
                <input
                  id="fuelLevel"
                  name="fuelLevel"
                  type="range"
                  min={0}
                  max={16}
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <span className="w-12 text-right text-sm tabular-nums">{fuelLevel}/16</span>
              </div>
            </div>
            <Field label="Original odometer" name="originalOdometer" defaultValue={dv("originalOdometer")} type="number" min={0} required />
            <Field label="Current odometer" name="currentOdometer" defaultValue={dv("currentOdometer")} type="number" min={0} required />
            <Field label="Key number" name="keyNumber" defaultValue={dv("keyNumber")} />
            <div className="flex flex-wrap items-end gap-6 sm:col-span-2">
              <CheckField label="Exclusive fleet" name="isExclusiveFleet" defaultChecked={iv.isExclusiveFleet === true} />
              <CheckField label="Active" name="isActive" defaultChecked={iv.isActive !== false} />
            </div>
          </FormSection>

          <FormSection id="compliance" title="Maintenance, insurance & licensing">
            <Field label="Maintenance begin odometer" name="maintenanceBeginOdometer" defaultValue={dv("maintenanceBeginOdometer")} type="number" min={0} />
            <Field label="Maintenance begin date" name="maintenanceBeginDate" defaultValue={dv("maintenanceBeginDate")} type="date" />
            <Field label="Maintenance every (km)" name="maintenanceEveryKm" defaultValue={dv("maintenanceEveryKm")} type="number" min={0} required />
            <Field label="Insurance amount" name="insuranceAmount" defaultValue={dv("insuranceAmount")} type="number" step="0.01" min={0} required />
            <Field label="Inspection date" name="inspectionDate" defaultValue={dv("inspectionDate")} type="date" />
            <Field label="Inspection amount" name="inspectionAmount" defaultValue={dv("inspectionAmount")} type="number" step="0.01" min={0} required />
            <Field label="License (plate) number" name="licenseNumber" defaultValue={dv("licenseNumber")} required inputClassName="uppercase" />
            <SelectField label="License province / state" name="licenseProvince" defaultValue={dv("licenseProvince")} options={REGION_OPTIONS} placeholder="—" />
            <Field label="License amount" name="licenseAmount" defaultValue={dv("licenseAmount")} type="number" step="0.01" min={0} />
            <Field label="Date license first registered" name="licenseFirstRegistered" defaultValue={dv("licenseFirstRegistered")} type="date" />
            <Field label="License expiration date" name="licenseExpiry" defaultValue={dv("licenseExpiry")} type="date" />
            <Field label="LDW (monthly rate)" name="ldwMonthlyRate" defaultValue={dv("ldwMonthlyRate")} type="number" step="0.01" min={0} required />
          </FormSection>

          <FormSection id="mechanical" title="Mechanical specs" optional>
            <SelectField label="Power train" name="powerTrain" defaultValue={dv("powerTrain")} options={[{ value: "FOUR_BY_TWO", label: "4X2" }, { value: "FOUR_BY_FOUR", label: "4X4" }]} placeholder="—" />
            <Field label="Fuel grade" name="fuelGrade" defaultValue={dv("fuelGrade")} />
            <Field label="Oil type" name="oilType" defaultValue={dv("oilType")} />
            <Field label="Dimensions" name="dimensions" defaultValue={dv("dimensions")} />
            <Field label="Maximum payload" name="maxPayload" defaultValue={dv("maxPayload")} inputMode="decimal" />
            <Field label="Vertical clearance" name="verticalClearance" defaultValue={dv("verticalClearance")} inputMode="decimal" />
            <Field label="Front tire pressure" name="frontTirePressure" defaultValue={dv("frontTirePressure")} />
            <Field label="Rear tire pressure" name="rearTirePressure" defaultValue={dv("rearTirePressure")} />
            <SelectField label="Engine brand" name="engineBrandId" defaultValue={dv("engineBrandId")} options={opt(o.engineBrands)} placeholder="—" />
            <SelectField label="Engine type" name="engineTypeId" defaultValue={dv("engineTypeId")} options={opt(o.engineTypes)} placeholder="—" />
            <Field label="GVWR" name="gvwr" defaultValue={dv("gvwr")} inputMode="decimal" />
            <Field label="City MPG" name="cityMpg" defaultValue={dv("cityMpg")} type="number" step="0.1" min={0} />
            <Field label="Highway MPG" name="highwayMpg" defaultValue={dv("highwayMpg")} type="number" step="0.1" min={0} />
          </FormSection>

          <FormSection id="pricing" title="Appearance & pricing" optional>
            <Field label="Interior colour" name="interiorColor" defaultValue={dv("interiorColor")} />
            <Field label="Marketing description" name="marketingDescription" defaultValue={dv("marketingDescription")} full />
            <Field label="Retail price — low" name="retailPriceLow" defaultValue={dv("retailPriceLow")} type="number" step="0.01" min={0} />
            <Field label="Retail price — high" name="retailPriceHigh" defaultValue={dv("retailPriceHigh")} type="number" step="0.01" min={0} />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium">Options</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {o.options.map((x) => (
                  <CheckField key={x.id} name="optionIds" value={x.id} data-multi="1" label={x.name} defaultChecked={Array.isArray(iv.optionIds) && iv.optionIds.includes(x.id)} />
                ))}
              </div>
            </fieldset>

            <details className="rounded-md border p-3 sm:col-span-2">
              <summary className="cursor-pointer text-sm font-medium">
                Legacy fields <Badge variant="warning" className="ml-1">pending client review</Badge>
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Carried over from RentCentric exactly. Kept until the client confirms whether they&apos;re still used.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Interior RGB" name="interiorRgb" defaultValue={dv("interiorRgb")} />
                <Field label="Exterior RGB" name="exteriorRgb" defaultValue={dv("exteriorRgb")} hint="Labelled “GVWR” by mistake on the old form." />
                <Field label="Stereo" name="stereo" defaultValue={dv("stereo")} />
                <Field label="Subscription PlanID" name="subscriptionPlanId" defaultValue={dv("subscriptionPlanId")} />
                <Field label="Monthly PlanID" name="monthlyPlanId" defaultValue={dv("monthlyPlanId")} />
                <Field label="Yearly PlanID" name="yearlyPlanId" defaultValue={dv("yearlyPlanId")} />
                <Field label="Weekly low mileage PlanID" name="weeklyLowMileagePlanId" defaultValue={dv("weeklyLowMileagePlanId")} />
                <Field label="Weekly high mileage PlanID" name="weeklyHighMileagePlanId" defaultValue={dv("weeklyHighMileagePlanId")} />
                <Field label="Monthly low mileage PlanID" name="monthlyLowMileagePlanId" defaultValue={dv("monthlyLowMileagePlanId")} />
                <Field label="Monthly high mileage PlanID" name="monthlyHighMileagePlanId" defaultValue={dv("monthlyHighMileagePlanId")} />
              </div>
            </details>
          </FormSection>

          <FormSection
            id="gps"
            title="GPS"
            optional
            description="Entered by hand for now. Once Moovetrax is connected it fills these automatically."
          >
            <Field label="Tracker ID" name="gpsTrackerId" defaultValue={dv("gpsTrackerId")} />
            <div />
            <Field label="Latitude" name="gpsLatitude" defaultValue={dv("gpsLatitude")} type="number" step="0.000001" min={-90} max={90} />
            <Field label="Longitude" name="gpsLongitude" defaultValue={dv("gpsLongitude")} type="number" step="0.000001" min={-180} max={180} />
          </FormSection>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {editing ? "Save changes" : "Add vehicle"}
            </Button>
          </div>
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}

function FormSection({
  id,
  title,
  description,
  optional,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</CardContent>
    </Card>
  );
}
