import Link from "next/link";
import { CalendarDaysIcon, CalendarPlusIcon, CarIcon, FileTextIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { cn } from "@mrac/ui/lib/utils";
import { ErpIcon, type ErpIconName } from "@mrac/ui/components/erp-icon";
import { PageHeader } from "../../_components/page-header";
import { api, can } from "../../_lib/session";
import { DashboardPanels } from "./_components/dashboard-panels";
import { KpiRow } from "./_components/dashboard-insights";

export const metadata = { title: "Dashboard" };

interface StatusTile {
  label: string;
  value: number;
  href?: string;
  icon: ErpIconName;
  tone?: "warn" | "bad" | "good";
}

export default async function DashboardPage() {
  const s = await (await api()).meta.fleetStatus();
  const today = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Vancouver" });

  const tiles: StatusTile[] = [
    { label: "In fleet", value: s.inFleet, href: "/admin/vehicles", icon: "stock-dark" },
    { label: "Available", value: s.available, href: "/admin/vehicles?status=AVAILABLE", icon: "approve", tone: "good" },
    { label: "On rent", value: s.onRent, href: "/admin/rentals?status=OPEN", icon: "truck", tone: "good" },
    { label: "Leaving today", value: s.leavingToday, href: "/admin/reservations", icon: "routes" },
    { label: "Returning today", value: s.returningToday, href: "/admin/rentals?status=OPEN", icon: "tick" },
    { label: "Overdue", value: s.overdue, href: "/admin/rentals?status=OPEN", icon: "bounced", tone: s.overdue ? "bad" : undefined },
    { label: "Rented today", value: s.rentedToday, icon: "record-payment" },
    { label: "Reservations tomorrow", value: s.rezTomorrow, href: "/admin/reservations", icon: "pending" },
    { label: "No-shows", value: s.noShow, icon: "cross", tone: s.noShow ? "warn" : undefined },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${today} · fleet, bookings and revenue at a glance`}
        actions={
          <>
            <Button asChild variant="ghost"><Link href="/admin/calendar"><CalendarDaysIcon /> Fleet calendar</Link></Button>
            {(await can("CheckAddQuote")) && <Button asChild variant="outline"><Link href="/admin/quotes/new"><FileTextIcon /> New quote</Link></Button>}
            {(await can("CheckOuts")) && <Button asChild variant="outline"><Link href="/admin/rentals/new"><CarIcon /> Start rental</Link></Button>}
            {(await can("ReservationsAdd")) && <Button asChild><Link href="/admin/reservations/new"><CalendarPlusIcon /> Make reservation</Link></Button>}
          </>
        }
      />
      <div className="space-y-6 p-4 md:p-6">

        <KpiRow onRent={s.onRent} inFleet={s.inFleet} overdue={s.overdue} />

        {/* Live status strip */}
        <Card className="gap-0 overflow-hidden p-0">
          <section aria-label="Fleet status" className="grid grid-cols-3 gap-px bg-border sm:grid-cols-5 lg:grid-cols-9">
            {tiles.map((t) => {
              const body = (
                <div className={cn("flex h-full flex-col gap-1.5 bg-card px-4 py-3.5", t.href && "transition-colors hover:bg-muted/60")}>
                  <span className="flex min-h-8 items-start gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ErpIcon name={t.icon} size={13} className="shrink-0 opacity-70" />
                    <span className="line-clamp-2 leading-tight">{t.label}</span>
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-bold tracking-[-0.03em] tabular-nums",
                      t.tone === "bad" && "text-destructive",
                      t.tone === "warn" && "text-warning",
                      t.tone === "good" && "text-success",
                    )}
                  >
                    {t.value}
                  </span>
                </div>
              );
              return t.href ? (
                <Link key={t.label} href={t.href} className="bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">{body}</Link>
              ) : (
                <div key={t.label} className="bg-card">{body}</div>
              );
            })}
          </section>
        </Card>

        <DashboardPanels />
      </div>
    </>
  );
}
