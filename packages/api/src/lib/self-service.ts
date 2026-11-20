/**
 * Settings > Self Service & Car Share SetUp > Rental Setup (RentCentric SelfServiceSetup.aspx): the same tick boxes and
 * numbers, in the same sections and order. Shared by the API (validation) and the settings page.
 */
export type SelfServiceField = { key: string; label: string; kind: "bool" } | { key: string; label: string; kind: "number"; unit: "Hours" | "Minutes" };

export const SELF_SERVICE_SECTIONS: { title: string; fields: SelfServiceField[] }[] = [
  {
    title: "Registration Form",
    fields: [
      { key: "driversLicense", label: "Driver's License", kind: "bool" },
      { key: "proofOfInsurance", label: "Proof Of Insurance", kind: "bool" },
      { key: "proofOfAddress", label: "Proof Of Address", kind: "bool" },
      { key: "creditCard", label: "Credit Card", kind: "bool" },
      { key: "selfie", label: "Selfie", kind: "bool" },
      { key: "insuranceInformation", label: "Insurance Information", kind: "bool" },
      { key: "driversLicenseNumber", label: "Driver's License Number", kind: "bool" },
      { key: "licenseStateProvince", label: "State/Province Issued", kind: "bool" },
      { key: "licenseCountry", label: "License Country", kind: "bool" },
      { key: "licenseExpiry", label: "Driver's License Expiry", kind: "bool" },
      { key: "creditCardNumber", label: "Credit Card Number", kind: "bool" },
      { key: "cardExpiry", label: "Card Expiration", kind: "bool" },
      { key: "creditCardType", label: "Credit Card Type", kind: "bool" },
      { key: "nameOnCard", label: "Name on Card", kind: "bool" },
      { key: "removeCustomerAddress", label: "Remove Customer Address", kind: "bool" },
    ],
  },
  {
    title: "Rental Management",
    fields: [
      { key: "carKeyRequiredToEndRental", label: "Car key required to end rental", kind: "bool" },
      { key: "autoActivateCustomers", label: "Auto Activate Customers on Registration", kind: "bool" },
      { key: "authorizeCardOnReservation", label: "Authorize Card Upon Reservation", kind: "bool" },
      { key: "authorizeCardOnExtendReservation", label: "Authorize Card Upon Extend Reservation", kind: "bool" },
      { key: "chargeCardOnExtendReservation", label: "Charge Card Upon Extend Reservation", kind: "bool" },
      { key: "authorizeCardOnRegistration", label: "Authorize Card Upon Registration", kind: "bool" },
      { key: "chargeCardOnReservation", label: "Charge Card Upon Reservation", kind: "bool" },
      { key: "chargeCardOnStartRental", label: "Charge Card Upon Start Rental", kind: "bool" },
      { key: "authorizeCardOnExtendRental", label: "Authorize Card Upon Extend Rental", kind: "bool" },
      { key: "chargeCardOnExtendRental", label: "Charge Card Upon Extend Rental", kind: "bool" },
      { key: "chargeCardOnEndRental", label: "Charge Card Upon Ending Rental", kind: "bool" },
      { key: "accessOnlyDuringReservation", label: "Allow Access to Vehicle Only During Reservation", kind: "bool" },
      { key: "emailInvoiceOnStart", label: "Email Invoice When Rental Starts", kind: "bool" },
      { key: "emailInvoiceOnEnd", label: "Email Invoice When Rental Ends", kind: "bool" },
      { key: "endRentalOnlyInLocation", label: "Allow End rental only inside location(s)", kind: "bool" },
      { key: "chargeActualTimeOnly", label: "Charge for the actual time only", kind: "bool" },
      { key: "inspectionAtStart", label: "Inspection mandatory at start rental", kind: "bool" },
      { key: "inspectionAtEnd", label: "Inspection mandatory at end rental", kind: "bool" },
    ],
  },
  {
    title: "Advanced Settings",
    fields: [
      { key: "minReservationHours", label: "Minimum Reservation Length", kind: "number", unit: "Hours" },
      { key: "maxReservationHours", label: "Maximum Reservation Length", kind: "number", unit: "Hours" },
      { key: "reservationBufferMinutes", label: "Reservation Buffer", kind: "number", unit: "Minutes" },
      { key: "cancellationMinutes", label: "Reservation Cancellation Time", kind: "number", unit: "Minutes" },
      { key: "allowedStartMinutes", label: "Allowed Time For Rental Starts", kind: "number", unit: "Minutes" },
      { key: "fleetToGo", label: "Fleet To Go", kind: "bool" },
      { key: "floatingUsers", label: "Floating users in Self Service", kind: "bool" },
    ],
  },
];

export const SELF_SERVICE_FIELDS = SELF_SERVICE_SECTIONS.flatMap((s) => s.fields);

/** Keywords for the Welcome / Registration emails (as listed in RentCentric). */
export const SELF_SERVICE_KEYWORDS = [
  "LocationLogo", "LocationName", "Address", "City", "website", "State", "Zip", "Country", "TollFree", "Phone", "fax", "Email",
  "FirstName", "LastName", "CustomerEmail", "CustomerPhone", "CustomerAddress", "CustomerCity", "CustomerCountry", "CustomerStateCode", "CustomerZip",
  "CustomerLicenseNumber", "CustomerLicenseExpiry", "CustomerBirthday",
] as const;

export type SelfServiceEmail = { fromName: string; format: "HTML" | "TEXT"; fromEmail: string; replyTo: string; subject: string; body: string };
