/** RentCentric's Reports menu (Reports.aspx), in its order. `slug` = built here (/admin/reports/<slug>). */
export type ReportCategory = { title: string; desc: string; icon: "todays-collection" | "truck" | "list" | "customers"; reports: { name: string; slug?: string }[] };

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: "Management Reports",
    desc: "Daily business, cash, month to date, revenue and event tracking",
    icon: "todays-collection",
    reports: [
      { name: "Daily Business Report", slug: "daily-business" },
      { name: "Daily Cash Summary Report", slug: "daily-cash" },
      { name: "Month to Date Report", slug: "month-to-date" },
      { name: "Rental Details", slug: "rental-details" }, { name: "Adjustment Details", slug: "adjustment-details" }, { name: "Invoices", slug: "invoices" },
      { name: "Rental Event Tracking", slug: "rental-event-tracking" }, { name: "Reservation Event Tracking", slug: "reservation-event-tracking" }, { name: "Tasks List", slug: "tasks" },
      { name: "Commissions", slug: "commissions" }, { name: "Broker Commission", slug: "broker-commission" }, { name: "Sales Projection", slug: "sales-projection" }, { name: "Work In Process", slug: "work-in-process" },
      { name: "Revenue By Customer", slug: "revenue-by-customer" }, { name: "Revenue By Vehicle", slug: "revenue-by-vehicle" }, { name: "Revenue By Location", slug: "revenue-by-location" }, { name: "Revenue By Rate", slug: "revenue-by-rate" },
      { name: "Revenue By Admin", slug: "revenue-by-admin" }, { name: "Revenue By Company", slug: "revenue-by-company" }, { name: "Revenue By Options", slug: "revenue-by-options" }, { name: "Non-Revenue", slug: "non-revenue" },
    ],
  },
  {
    title: "Rentals & Reservations",
    desc: "Rental status, manifests, receivables and schedulers",
    icon: "list",
    reports: [
      { name: "Rental Status", slug: "rental-status" },
      { name: "Reservation Manifest", slug: "reservation-manifest" },
      { name: "Vehicle Rental Calendar" }, { name: "Corporate A/R By Bills", slug: "corporate-ar" }, { name: "Customer A/R Report", slug: "customer-ar" }, { name: "Reservation A/R by Bills", slug: "reservation-ar" },
      { name: "Corporate A/R Analysis", slug: "corporate-ar-analysis" }, { name: "Fleet Grid" }, { name: "Custom Reports" }, { name: "Reservation Forecast" }, { name: "Reservation Grid" },
      { name: "Reservations No Showup/Cancelled", slug: "no-show-cancelled" }, { name: "Reservations Calendar" }, { name: "Dynamic Scheduler" }, { name: "Visual Scheduler" },
      { name: "Promo Code", slug: "promo-code" }, { name: "Rental Days", slug: "rental-days" }, { name: "Rental Discount", slug: "rental-discount" },
    ],
  },
  {
    title: "Vehicles",
    desc: "Fleet summary, utilization, due in, maintenance and repairs",
    icon: "truck",
    reports: [
      { name: "Vehicle Due In", slug: "vehicle-due-in" },
      { name: "Vehicles Summary", slug: "vehicles-summary" }, { name: "Vehicles Summary with QR Code" }, { name: "Vehicle Utilization (Today)", slug: "vehicle-utilization" }, { name: "Fleet Utilization History", slug: "fleet-utilization-history" },
      { name: "Fleet Utilization For Cast", slug: "fleet-utilization-forecast" }, { name: "Vehicle License Expiration", slug: "license-expiration" }, { name: "Vehicle Profit/Loss", slug: "vehicle-profit" }, { name: "Repair Orders" },
      { name: "Vehicle Repairs", slug: "vehicle-repairs" }, { name: "Vehicle Lease/Loan", slug: "vehicle-lease-loan" }, { name: "Vehicle Maintenance", slug: "vehicle-maintenance" }, { name: "Maintenance Alert", slug: "maintenance-alert" },
      { name: "Snap Shot For Rentals / Vehicle Type", slug: "snap-shot" }, { name: "Vehicle Insurance", slug: "vehicle-insurance" }, { name: "KM Difference/Missing", slug: "km-difference" }, { name: "Fleet Utilization Snapshot", slug: "fleet-utilization-snapshot" }, { name: "Checklist Overview", slug: "checklist-overview" },
    ],
  },
  {
    title: "Customers",
    desc: "Customer lists, referrals, tickets and payments",
    icon: "customers",
    reports: [
      { name: "Customer List", slug: "customer-list" }, { name: "Customer By Region", slug: "customer-by-region" }, { name: "Traffic Tickets", slug: "traffic-tickets" }, { name: "Source Of Referral", slug: "source-of-referral" },
      { name: "Payments & Charges", slug: "payments-and-charges" }, { name: "Customer Notes", slug: "customer-notes" }, { name: "Undesired Customers", slug: "undesired-customers" },
    ],
  },
];

export const BUILT_REPORTS: Record<string, { name: string; category: string }> = Object.fromEntries(
  REPORT_CATEGORIES.flatMap((c) => c.reports.filter((r) => r.slug).map((r) => [r.slug!, { name: r.name, category: c.title }])),
);
