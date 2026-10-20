import Link from "next/link";
import { Card, CardContent } from "@mrac/ui/components/card";
import { cn } from "@mrac/ui/lib/utils";
import { ErpIcon, type ErpIconName } from "@mrac/ui/components/erp-icon";
import { PageHeader } from "../../_components/page-header";
import { api } from "../../_lib/session";
import { DashboardPanels } from "./_components/dashboard-panels";

export const metadata = { title: "Dashboard" };

interface StatusTile {
  label: string;
  value: number;
  href?: string;
  icon: ErpIconName;
  accentBorder: string;
  tone?: "warn" | "bad" | "good";
}

export default async function DashboardPage() {
  const s = await (await api()).meta.fleetStatus();
  const utilization = s.inFleet > 0 ? Math.round((s.onRent / s.inFleet) * 100) : 0;

  const tiles: StatusTile[] = [
    {
      label: "In fleet",
      value: s.inFleet,
      href: "/admin/vehicles",
      icon: "stock-dark",
      accentBorder: "border-t-carbon-80",
    },
    {
      label: "Available",
      value: s.available,
      href: "/admin/vehicles?status=AVAILABLE",
      icon: "approve",
      accentBorder: "border-t-forest-100",
      tone: "good",
    },
    {
      label: "On rent",
      value: s.onRent,
      href: "/admin/rentals?status=OPEN",
      icon: "truck",
      accentBorder: "border-t-forest-100",
      tone: "good",
    },
    {
      label: "Leaving today",
      value: s.leavingToday,
      href: "/admin/reservations",
      icon: "routes",
      accentBorder: "border-t-yellow-100",
    },
    {
      label: "Returning today",
      value: s.returningToday,
      href: "/admin/rentals?status=OPEN",
      icon: "tick",
      accentBorder: "border-t-forest-80",
    },
    {
      label: "Overdue",
      value: s.overdue,
      href: "/admin/rentals?status=OPEN",
      icon: "bounced",
      accentBorder: "border-t-terra-100",
      tone: s.overdue ? "bad" : undefined,
    },
    {
      label: "Rented today",
      value: s.rentedToday,
      icon: "record-payment",
      accentBorder: "border-t-terra-80",
    },
    {
      label: "Reservations tomorrow",
      value: s.rezTomorrow,
      href: "/admin/reservations",
      icon: "pending",
      accentBorder: "border-t-yellow-100",
    },
    {
      label: "No-shows",
      value: s.noShow,
      icon: "cross",
      accentBorder: "border-t-carbon-60",
      tone: s.noShow ? "warn" : undefined,
    },
  ];

  return (
    <>
      <PageHeader
        title="Fleet Operations Dashboard"
        description="Real-time vehicle utilization, reservations, and turnaround telemetry."
      />
      <div className="space-y-6 p-4 md:p-6">
        {/* Executive Quick Banner */}
        <div className="relative overflow-hidden rounded-lg bg-erp-hero-pattern p-5 text-white shadow-md">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-[#E9E3D5]/80 font-sans">
                Fleet Capacity Telemetry
              </span>
              <h2 className="font-serif text-2xl font-bold tracking-tight text-white mt-0.5">
                {s.onRent} Active Units On-Rent across Branches
              </h2>
              <p className="text-xs text-[#E9E3D5]/90 font-sans mt-1">
                {s.available} ready for assignment · {s.leavingToday} departure(s) scheduled today
              </p>
            </div>
            <div className="flex items-center gap-3 bg-black/20 backdrop-blur-xs rounded-md px-4 py-2.5 border border-white/10">
              <div className="text-right">
                <div className="text-[10.5px] uppercase font-bold tracking-widest text-[#E9E3D5]/70 font-sans">
                  Utilization
                </div>
                <div className="font-serif text-2xl font-bold text-white">{utilization}%</div>
              </div>
              <ErpIcon name="stock" size={24} className="opacity-90" />
            </div>
          </div>
        </div>

        {/* Status KPI Cards */}
        <section aria-label="Fleet status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {tiles.map((t) => {
            const body = (
              <Card
                className={cn(
                  "gap-1 rounded-md border border-border bg-card p-3.5 shadow-2xs transition-all border-t-[3px]",
                  t.accentBorder,
                  t.href && "hover:border-primary/60 hover:shadow-xs cursor-pointer",
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground font-sans line-clamp-1">
                      {t.label}
                    </span>
                    <ErpIcon name={t.icon} size={15} className="opacity-70 shrink-0" />
                  </div>
                  <div
                    className={cn(
                      "font-serif text-2xl font-bold tabular-nums text-foreground",
                      t.tone === "bad" && "text-destructive",
                      t.tone === "warn" && "text-amber-600 dark:text-amber-400",
                      t.tone === "good" && "text-forest-100 dark:text-emerald-400",
                    )}
                  >
                    {t.value}
                  </div>
                </CardContent>
              </Card>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                {body}
              </Link>
            ) : (
              <div key={t.label}>{body}</div>
            );
          })}
        </section>

        <DashboardPanels />
      </div>
    </>
  );
}
