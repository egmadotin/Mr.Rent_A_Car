import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../_components/page-header";
import { api } from "../../../../../_lib/session";
import { VehicleForm } from "../../new/vehicle-form";

export const metadata = { title: "Edit vehicle" };

const day = (x: Date | null | undefined) => (x ? new Date(x).toISOString().slice(0, 10) : "");
const s = (x: unknown) => (x == null ? "" : String(x));

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await (await api()).vehicle.byId({ vehicleId: id }).catch(() => null);
  if (!v) notFound();

  const values: Record<string, string | boolean | string[]> = {
    assignedId: v.assignedId, name: s(v.name), makeId: v.makeId, modelId: v.modelId, modelCode: s(v.modelCode), year: s(v.year),
    colour: s(v.colour), vehicleTypeId: v.vehicleTypeId, transmission: s(v.transmission), doors: s(v.doors), cylinders: s(v.cylinders),
    vin: s(v.vin), spotNumber: s(v.spotNumber), memo: s(v.memo),
    rentalLocationId: v.rentalLocationId, owningLocationId: v.owningLocationId, currentLocationId: s(v.currentLocationId), status: v.status,
    categoryId: s(v.categoryId), bodyId: s(v.bodyId), fuelTypeId: s(v.fuelTypeId), tankSize: s(v.tankSize), fuelLevel: s(v.fuelLevel),
    originalOdometer: s(v.originalOdometer), currentOdometer: s(v.currentOdometer), keyNumber: s(v.keyNumber),
    isExclusiveFleet: v.isExclusiveFleet, isActive: v.isActive,
    maintenanceBeginOdometer: s(v.maintenanceBeginOdometer), maintenanceBeginDate: day(v.maintenanceBeginDate), maintenanceEveryKm: s(v.maintenanceEveryKm),
    insuranceAmount: s(v.insuranceAmount), inspectionDate: day(v.inspectionDate), inspectionAmount: s(v.inspectionAmount),
    licenseNumber: s(v.licenseNumber), licenseProvince: s(v.licenseProvince), licenseAmount: s(v.licenseAmount),
    licenseFirstRegistered: day(v.licenseFirstRegistered), licenseExpiry: day(v.licenseExpiry), ldwMonthlyRate: s(v.ldwMonthlyRate),
    powerTrain: s(v.powerTrain), fuelGrade: s(v.fuelGrade), oilType: s(v.oilType), dimensions: s(v.dimensions), maxPayload: s(v.maxPayload),
    verticalClearance: s(v.verticalClearance), frontTirePressure: s(v.frontTirePressure), rearTirePressure: s(v.rearTirePressure),
    engineBrandId: s(v.engineBrandId), engineTypeId: s(v.engineTypeId), gvwr: s(v.gvwr), cityMpg: s(v.cityMpg), highwayMpg: s(v.highwayMpg),
    interiorColor: s(v.interiorColor), interiorRgb: s(v.interiorRgb), exteriorRgb: s(v.exteriorRgb), stereo: s(v.stereo),
    subscriptionPlanId: s(v.subscriptionPlanId), monthlyPlanId: s(v.monthlyPlanId), yearlyPlanId: s(v.yearlyPlanId),
    weeklyLowMileagePlanId: s(v.weeklyLowMileagePlanId), weeklyHighMileagePlanId: s(v.weeklyHighMileagePlanId),
    monthlyLowMileagePlanId: s(v.monthlyLowMileagePlanId), monthlyHighMileagePlanId: s(v.monthlyHighMileagePlanId),
    marketingDescription: s(v.marketingDescription), retailPriceLow: s(v.retailPriceLow), retailPriceHigh: s(v.retailPriceHigh),
    optionIds: v.options.map((o) => o.optionId),
    gpsTrackerId: s(v.gpsTrackerId), gpsLatitude: s(v.gpsLatitude), gpsLongitude: s(v.gpsLongitude),
  };

  return (
    <>
      <PageHeader
        title={`Edit vehicle ${v.assignedId}`}
        breadcrumbs={[{ label: "Vehicles", href: "/admin/vehicles" }, { label: v.assignedId, href: `/admin/vehicles/${v.id}` }, { label: "Edit" }]}
        description="Same fields as Add vehicle. Every change is recorded in the vehicle's history."
      />
      <VehicleForm initial={{ vehicleId: v.id, values }} />
    </>
  );
}
