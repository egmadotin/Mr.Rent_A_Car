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
      { name: "Rental Details" }, { name: "Adjustment Details" }, { name: "Invoices" },
      { name: "Rental Event Tracking" }, { name: "Reservation Event Tracking" }, { name: "Tasks List" },
      { name: "Commissions" }, { name: "Broker Commission" }, { name: "Sales Projection" }, { name: "Work In Process" },
      { name: "Revenue By Customer", slug: "revenue-by-customer" }, { name: "Revenue By Vehicle", slug: "revenue-by-vehicle" }, { name: "Revenue By Location", slug: "revenue-by-location" }, { name: "Revenue By Rate" },
      { name: "Revenue By Admin" }, { name: "Revenue By Company", slug: "revenue-by-company" }, { name: "Revenue By Options" }, { name: "Non-Revenue" },
    ],
  },
  {
    title: "Rentals & Reservations",
    desc: "Rental status, manifests, receivables and schedulers",
    icon: "list",
    reports: [
      { name: "Rental Status", slug: "rental-status" },
      { name: "Reservation Manifest", slug: "reservation-manifest" },
      { name: "Vehicle Rental Calendar" }, { name: "Corporate A/R By Bills" }, { name: "Customer A/R Report" }, { name: "Reservation A/R by Bills" },
      { name: "Corporate A/R Analysis" }, { name: "Fleet Grid" }, { name: "Custom Reports" }, { name: "Reservation Forecast" }, { name: "Reservation Grid" },
      { name: "Reservations No Showup/Cancelled" }, { name: "Reservations Calendar" }, { name: "Dynamic Scheduler" }, { name: "Visual Scheduler" },
      { name: "Promo Code" }, { name: "Rental Days" }, { name: "Rental Discount" },
    ],
  },
  {
    title: "Vehicles",
    desc: "Fleet summary, utilization, due in, maintenance and repairs",
    icon: "truck",
    reports: [
      { name: "Vehicle Due In", slug: "vehicle-due-in" },
      { name: "Vehicles Summary" }, { name: "Vehicles Summary with QR Code" }, { name: "Vehicle Utilization (Today)" }, { name: "Fleet Utilization History" },
      { name: "Fleet Utilization For Cast" }, { name: "Vehicle License Expiration" }, { name: "Vehicle Profit/Loss" }, { name: "Repair Orders" },
      { name: "Vehicle Repairs" }, { name: "Vehicle Lease/Loan" }, { name: "Vehicle Maintenance" }, { name: "Maintenance Alert" },
      { name: "Snap Shot For Rentals / Vehicle Type" }, { name: "Vehicle Insurance" }, { name: "KM Difference/Missing" }, { name: "Fleet Utilization Snapshot" }, { name: "Checklist Overview" },
    ],
  },
  {
    title: "Customers",
    desc: "Customer lists, referrals, tickets and payments",
    icon: "customers",
    reports: [
      { name: "Customer List" }, { name: "Customer By Region" }, { name: "Traffic Tickets" }, { name: "Source Of Referral" },
      { name: "Payments & Charges" }, { name: "Customer Notes" }, { name: "Undesired Customers" },
    ],
  },
];

export const BUILT_REPORTS: Record<string, { name: string; category: string }> = Object.fromEntries(
  REPORT_CATEGORIES.flatMap((c) => c.reports.filter((r) => r.slug).map((r) => [r.slug!, { name: r.name, category: c.title }])),
);
