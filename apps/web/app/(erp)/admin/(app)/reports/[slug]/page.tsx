import { notFound } from "next/navigation";
import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { DailyCashReport, RentalStatusReport, ReservationManifestReport, VehicleDueInReport } from "../_components/list-reports";
import { DailyBusinessReport, MonthToDateReport } from "../_components/revenue-reports";
import { CustomerListReport, LicenseExpirationReport, MaintenanceAlertReport, TrafficTicketsReport, UndesiredCustomersReport, VehiclesSummaryReport } from "../_components/fleet-customer-reports";
import { RevenueByCompanyReport, RevenueByCustomerReport, RevenueByLocationReport, RevenueByVehicleReport } from "../_components/revenue-by";
import { BUILT_REPORTS } from "../report-list";

const SCREENS: Record<string, () => React.JSX.Element> = {
  "daily-business": DailyBusinessReport,
  "daily-cash": DailyCashReport,
  "month-to-date": MonthToDateReport,
  "rental-status": RentalStatusReport,
  "reservation-manifest": ReservationManifestReport,
  "vehicle-due-in": VehicleDueInReport,
  "revenue-by-customer": RevenueByCustomerReport,
  "revenue-by-vehicle": RevenueByVehicleReport,
  "revenue-by-location": RevenueByLocationReport,
  "revenue-by-company": RevenueByCompanyReport,
  "vehicles-summary": VehiclesSummaryReport,
  "license-expiration": LicenseExpirationReport,
  "maintenance-alert": MaintenanceAlertReport,
  "customer-list": () => <CustomerListReport />,
  "undesired-customers": UndesiredCustomersReport,
  "traffic-tickets": TrafficTicketsReport,
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: BUILT_REPORTS[(await params).slug]?.name ?? "Report" };
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireStaff();
  const { slug } = await params;
  const Screen = SCREENS[slug];
  const meta = BUILT_REPORTS[slug];
  if (!Screen || !meta) notFound();
  return (
    <>
      <div className="print:hidden">
        <PageHeader title={meta.name} breadcrumbs={[{ label: "Reports", href: "/admin/reports" }, { label: meta.category }, { label: meta.name }]} />
      </div>
      <Screen />
    </>
  );
}
