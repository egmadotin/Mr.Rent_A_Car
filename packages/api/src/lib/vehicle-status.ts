// Vehicle statuses, in the same order and wording as the RentCentric vehicle form.
// Single source for the API input schema, the vehicle form, the list filter and the status badge.
// Must stay in sync with `enum VehicleStatus` in packages/db/prisma/schema.prisma.

export const VEHICLE_STATUSES = [
  { value: "ACCIDENT_REPLACEMENT", label: "Accident Replacement", tone: "warning" },
  { value: "AUCTION", label: "Auction", tone: "muted" },
  { value: "AVAILABLE", label: "Available", tone: "success" },
  { value: "COMPREHENSIVE", label: "Comprehensive", tone: "warning" },
  { value: "FOR_SALE", label: "For Sale", tone: "warning" },
  { value: "GROUNDED", label: "Grounded", tone: "destructive" },
  { value: "HAS_PROBLEM", label: "Has Problem", tone: "destructive" },
  { value: "HOLD_FOR_SALE", label: "Hold for Sale", tone: "warning" },
  { value: "IN_CHECKOUT_PROCESS", label: "In Checkout Process", tone: "info" },
  { value: "IN_REPAIR", label: "In Repair", tone: "destructive" },
  { value: "IN_SERVICE", label: "In Service", tone: "warning" },
  { value: "LEASED_REPLACEMENT", label: "Leased Replacement", tone: "info" },
  { value: "ON_RENT", label: "On Rent", tone: "info" },
  { value: "OUT_OF_SERVICE", label: "Out of Service", tone: "destructive" },
  { value: "SOLD", label: "Sold", tone: "muted" },
  { value: "STAFF", label: "Staff", tone: "info" },
  { value: "STOLEN", label: "Stolen", tone: "destructive" },
] as const;

export type VehicleStatusValue = (typeof VEHICLE_STATUSES)[number]["value"];

export const VEHICLE_STATUS_VALUES = VEHICLE_STATUSES.map((s) => s.value) as [VehicleStatusValue, ...VehicleStatusValue[]];
