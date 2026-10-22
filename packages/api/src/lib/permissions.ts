/**
 * RentCentric's user-group permissions (AdminGroupsModify.aspx), in its sections and order. Keys are RentCentric's
 * checkbox ids so groups import 1:1; labels are its labels. Users with the admin role ("Full Admin") have all of them.
 */
export const PERMISSION_SECTIONS: { title: string; items: [key: string, label: string][] }[] = [
  { title: "Customers", items: [["Customers", "View"], ["CustomersAdd", "Add"], ["CustomersDelete", "Disable"], ["CustomersEdit", "Edit"], ["chkViewCustomerPasswords", "View Customer Passwords"], ["cbCustomerAddCountry", "Add Country"], ["cbCustomerAddProvince", "Add Province"], ["cbCustomerAddCity", "Add City"]] },
  { title: "Quotes", items: [["CheckViewQuote", "View"], ["CheckAddQuote", "Add"], ["CheckEditkOuote", "Edit"], ["CheckDeleteQuote", "Delete"]] },
  {
    title: "Reservations",
    items: [["Reservations", "View"], ["ReservationsAdd", "Add"], ["ReservationsDelete", "Cancel"], ["ReservationsEdit", "Edit"], ["ReservationsDeleteReal", "Delete"], ["CheckBoxWebCustomerSetup", "Web Customer Setup"], ["cbReservationEditDeposit", "Edit Deposit"], ["cbReservationAddCountry", "Add Country"], ["cbReservationAddProvince", "Add Province"], ["cbReservationAddCity", "Add City"]],
  },
  {
    title: "Rentals",
    items: [
      ["Agreements", "View"], ["AgreementsAdd", "Add"], ["AgreementsDelete", "Delete"], ["AgreementsCancel", "Cancel"], ["AgreementsEdit", "Edit"], ["CheckIns", "End Rental"], ["CheckOuts", "Start Rental"],
      ["RateChange", "Rate Change"], ["Overbook", "Allow Overbook"], ["FullPayment", "Full Payment"], ["ClosedAgreementsEdit", "Edit Closed Rentals"], ["CKAllowAdjustments", "Allow Adjustments"],
      ["chkCheckoutDateChange", "Checkout date Change"], ["chkCheckinDateChange", "Checkin date Change"], ["chkExpectedDateChange", "Expected date Change"], ["chkAllowReOpenRentals", "Allow ReOpen Rentals"],
      ["chkAllowUnVoidRentals", "Allow UnVoid Rentals"], ["chkUpdateDiscountAfterStartRental", "Update Discount After StartRental"], ["chkInsuranceRateChange", "Insurance Rate Change"],
      ["chkMiscChargeRateChange", "MiscCharge Rate Change"], ["chkTaxRateChange", "Tax Rate Change"], ["cbRentalEditDeposit", "Edit Deposit"], ["cbRentalAddCountry", "Add Country"], ["cbRentalAddProvince", "Add Province"], ["cbRentalAddCity", "Add City"],
    ],
  },
  { title: "Credit Cards & Transactions", items: [["CCNumber", "View Credit Card"], ["CCProcess", "Process Credit Card"], ["Transactions", "Refund"], ["TransactionsDelete", "Delete Transactions"], ["TransactionsEdit", "Edit Transactions"], ["TransactionsVoid", "Void Transactions"], ["EditDateNewpayment", "Edit Date New payment"]] },
  { title: "Rates", items: [["Rates", "View"], ["RatesAdd", "Add"], ["RatesDelete", "Disable"], ["RatesEdit", "Edit"]] },
  { title: "Insurances", items: [["Insurances", "View"], ["InsurancesAdd", "Add"], ["InsurancesDelete", "Disable"], ["InsurancesEdit", "Edit"]] },
  { title: "Miscellaneous Charges", items: [["Surchanrges", "View"], ["SurchanrgesAdd", "Add"], ["SurchanrgesDelete", "Disable"], ["SurchanrgesEdit", "Edit"]] },
  { title: "Locations", items: [["Locations", "View"], ["LocationsAdd", "Add"], ["LocationsDelete", "Disable"], ["LocationsEdit", "Edit"]] },
  { title: "Reports & Administration", items: [["Reports", "Reports"], ["Settings", "Administration"], ["ManagementReports", "Management Reports"], ["Manage", "Manage"]] },
  { title: "Rentals & Invoices (templates)", items: [["AgreementForms", "View"], ["AgreementFormsAdd", "Add"], ["AgreementFormsDelete", "Delete"], ["AgreementFormsEdit", "Edit"]] },
  { title: "Claims", items: [["Claims", "View"], ["ClaimsAdd", "Add"], ["ClaimsDelete", "Delete"], ["ClaimsEdit", "Edit"]] },
  { title: "Companies", items: [["Company", "View"], ["CompanyAdd", "Add"], ["CompanyDelete", "Delete"], ["CompanyEdit", "Edit"], ["chkViewCompanyUserPasswords", "View Company User Passwords"]] },
  { title: "Corporate Discounts", items: [["CorpDiscounts", "View"], ["CorpDiscountsAdd", "Add"], ["CorpDiscountsDelete", "Delete"], ["CorpDiscountsEdit", "Edit"], ["CKEditDirectBill", "Edit Direct Bill"], ["CKEditHighCredit", "Edit High Credit"]] },
  { title: "Bill Split", items: [["BillSplitView", "View"], ["BillSplitAdd", "Add"], ["BillSplitDelete", "Delete"], ["BillSplitEdit", "Edit"]] },
  { title: "Vehicles", items: [["Vehicles", "View"], ["VehiclesAdd", "Add"], ["VehiclesDelete", "Disable"], ["VehiclesEdit", "Edit"], ["ChangeEditLockStatus", "Change / Edit lock status"], ["VehicleLocation", "Vehicle Location"]] },
  { title: "Maintenance", items: [["Maintenance", "View"], ["MaintenanceAdd", "Add"], ["MaintenanceDelete", "Delete"], ["MaintenanceEdit", "Edit"]] },
  { title: "Repairs", items: [["Repairs", "View"], ["RepairsAdd", "Add"], ["RepairsDelete", "Delete"], ["RepairsEdit", "Edit"]] },
  { title: "Repair Orders", items: [["RepairOrders", "View"], ["RepairOrdersAdd", "Add"], ["RepairOrdersEdit", "Edit"], ["RepairOrdersEditApproved", "Edit Approved"], ["RepairOrdersEditClosed", "Edit Closed"]] },
  { title: "Vehicle Problems", items: [["VehicleProblems", "View"], ["VehicleProblemsAdd", "Add"], ["VehicleProblemsDelete", "Delete"], ["VehicleProblemsEdit", "Edit"]] },
  { title: "Carwash", items: [["Carwash", "View"], ["CarwashAdd", "Add"], ["CarwashDelete", "Disable"], ["CarwashEdit", "Edit"]] },
  { title: "Damages", items: [["Damages", "View"], ["DamagesAdd", "Add"], ["DamagesEdit", "Edit"]] },
  { title: "Accidents", items: [["Accidents", "View"], ["AccidentsAdd", "Add"], ["AccidentsDelete", "Delete"], ["AccidentsEdit", "Edit"]] },
  { title: "Users", items: [["Admins", "View"], ["AdminsAdd", "Add"], ["AdminsDelete", "Delete"], ["AdminsEdit", "Edit"]] },
  { title: "Commissions", items: [["Commissions", "View"], ["CommissionsAdd", "Add"], ["CommissionsDelete", "Delete"], ["CommissionsEdit", "Edit"]] },
  { title: "Reports shown", items: [["cbDisplayDailyCashSummaryReport", "Display Daily Cash Summary Report"], ["cbDisplayAgreementsReport", "Display Rentals Report"]] },
  { title: "Tasks", items: [["TasksAdd", "Add Task"]] },
  { title: "Notes", items: [["ViewNotes", "View"], ["AddNotesCheckbox", "Add"], ["EditNotesCheckbox", "Edit"], ["DeleteNotesCheckbox", "Delete"]] },
  { title: "Traffic Tickets", items: [["TrafficTickets", "View"], ["TrafficTicketsAdd", "Add"], ["TrafficTicketsDelete", "Delete"], ["TrafficTicketsEdit", "Edit"]] },
  { title: "Other", items: [["cbUseMobileAps", "Use Mobile Apps"], ["cbWordPress", "Wordpress Access"], ["cbOverrideHoursOfOperation", "Override Hours Of Operation"]] },
];

export const ALL_PERMISSIONS = PERMISSION_SECTIONS.flatMap((s) => s.items.map(([k]) => k));
export type Permission = string;

type PermUser = { role?: string | null; permissionsAdded?: string[]; permissionsRemoved?: string[]; userGroup?: { isActive: boolean; permissions: string[] } | null };

/** Admin role = "Full Admin": everything. Otherwise the user's active group's ticks. */
export function can(user: PermUser, permission: Permission) {
  return user.role === "admin" || effectivePermissions(user).includes(permission);
}

/** A user's permissions: their group's (when the group is active), plus the user's own extra ticks, minus the ones taken away. */
export function effectivePermissions(user: PermUser): string[] {
  if (user.role === "admin") return ALL_PERMISSIONS;
  const group = user.userGroup?.isActive ? user.userGroup.permissions : [];
  const removed = new Set(user.permissionsRemoved ?? []);
  return [...new Set([...group, ...(user.permissionsAdded ?? [])])].filter((p) => !removed.has(p) && ALL_PERMISSIONS.includes(p));
}

/** "Rentals › Edit Closed Rentals" */
export function permissionLabel(key: string) {
  for (const s of PERMISSION_SECTIONS) for (const [k, label] of s.items) if (k === key) return `${s.title} › ${label}`;
  return key;
}
