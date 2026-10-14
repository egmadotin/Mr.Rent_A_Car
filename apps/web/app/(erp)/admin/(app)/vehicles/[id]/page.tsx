/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { LocalDateTime } from "@mrac/ui/components/local-time";
import { date, fuel, money } from "@mrac/ui/lib/format";
import { PageHeader } from "../../../../_components/page-header";
import { api } from "../../../../_lib/session";
import { VehicleStatusBadge } from "../vehicles-list";

export const metadata = { title: "Vehicle" };

/**
 * Vehicle summary (Edit opens the full form). The full Vehicle detail redesign (Accidents, Damage, Maintenance,
 * Repairs, Inspections … the legacy ~16 action links) is a later module.
 */
export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await (await api()).vehicle.byId({ vehicleId: id }).catch(() => null);
  if (!v) notFound();

  const groups: [string, [string, React.ReactNode][]][] = [
    ["Identity & spec", [
      ["Assigned ID", v.assignedId], ["Vehicle name", v.name], ["Make / model", `${v.make.name} ${v.model.name}`], ["Model code", v.modelCode],
      ["Year", v.year], ["Colour", v.colour], ["Type", v.vehicleType.name], ["Transmission", v.transmission?.toLowerCase()], ["Doors", v.doors],
      ["Cylinders", v.cylinders], ["VIN", v.vin], ["Spot number", v.spotNumber],
    ]],
    ["Operations", [
      ["Rental location", v.rentalLocation.name], ["Owning location", v.owningLocation.name], ["Current location", v.currentLocation?.name],
      ["Category", v.category?.name], ["Body", v.body?.name], ["Fuel type", v.fuelType?.name], ["Tank size", v.tankSize], ["Fuel level", fuel(v.fuelLevel)],
      ["Original odometer", v.originalOdometer?.toLocaleString()], ["Current odometer", v.currentOdometer?.toLocaleString()], ["Key number", v.keyNumber],
      ["Exclusive fleet", v.isExclusiveFleet ? "Yes" : "No"],
    ]],
    ["Maintenance, insurance & licensing", [
      ["Maint. begin odometer", v.maintenanceBeginOdometer?.toLocaleString()], ["Maint. begin date", date(v.maintenanceBeginDate)], ["Maint. every km", v.maintenanceEveryKm.toLocaleString()],
      ["Insurance amount", money(v.insuranceAmount)], ["Inspection date", date(v.inspectionDate)], ["Inspection amount", money(v.inspectionAmount)],
      ["Plate", v.licenseNumber], ["Province / state", v.licenseProvince], ["License amount", money(v.licenseAmount)],
      ["First registered", date(v.licenseFirstRegistered)], ["License expiry", date(v.licenseExpiry)], ["LDW monthly", money(v.ldwMonthlyRate)],
    ]],
    ["Mechanical", [
      ["Power train", v.powerTrain === "FOUR_BY_FOUR" ? "4X4" : v.powerTrain === "FOUR_BY_TWO" ? "4X2" : null], ["Fuel grade", v.fuelGrade], ["Oil type", v.oilType],
      ["Dimensions", v.dimensions], ["Max payload", v.maxPayload], ["Vertical clearance", v.verticalClearance], ["Tire pressure F / R", [v.frontTirePressure, v.rearTirePressure].filter(Boolean).join(" / ")],
      ["Engine", [v.engineBrand?.name, v.engineType?.name].filter(Boolean).join(" ")], ["GVWR", v.gvwr], ["MPG city / hwy", [v.cityMpg, v.highwayMpg].filter(Boolean).join(" / ")],
    ]],
    ["Appearance & pricing", [
      ["Interior colour", v.interiorColor], ["Retail price", [v.retailPriceLow, v.retailPriceHigh].filter(Boolean).map((x) => money(x)).join(" – ")],
      ["Marketing description", v.marketingDescription], ["Options", v.options.map((o) => o.option.name).join(", ")],
    ]],
    ["GPS", [
      ["Tracker ID", v.gpsTrackerId], ["Position", v.gpsLatitude != null ? `${v.gpsLatitude}, ${v.gpsLongitude}` : null], ["Updated", <LocalDateTime key="g" value={v.gpsUpdatedAt} />],
    ]],
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Vehicles", href: "/admin/vehicles" }, { label: v.assignedId }]}
        title={
          <span className="flex items-center gap-2">
            {v.year} {v.make.name} {v.model.name} <span className="text-muted-foreground">({v.assignedId})</span>
            <VehicleStatusBadge status={v.status} />
            {!v.isActive && <Badge variant="muted">Inactive</Badge>}
          </span>
        }
        description={`${v.vehicleType.name} · Plate ${v.licenseNumber}`}
        actions={
          <Button asChild>
            <Link href={`/admin/vehicles/${v.id}/edit`}>
              <PencilIcon /> Edit
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-2">
        {v.vehicleType.imageKey && (
          <Card>
            <CardHeader><CardTitle>Class photo</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-4">
              <img src={v.vehicleType.imageKey} alt={v.vehicleType.name} className="h-32 w-56 shrink-0 rounded-md bg-white object-contain" />
              <div className="text-sm">
                <div className="font-medium">{v.vehicleType.name}</div>
                {v.vehicleType.description && <div className="text-muted-foreground">{v.vehicleType.description}</div>}
              </div>
            </CardContent>
          </Card>
        )}
        {groups.map(([title, items]) => (
          <Card key={title}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {items.map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[9rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words">{val === null || val === undefined || val === "" ? "—" : val}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
