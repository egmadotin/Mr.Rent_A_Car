import Link from "next/link";
import { Card, CardContent } from "@mrac/ui/components/card";
import { cn } from "@mrac/ui/lib/utils";
import { PageHeader } from "../../_components/page-header";
import { api } from "../../_lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const s = await (await api()).meta.fleetStatus();
  const tiles: { label: string; value: number; href?: string; tone?: "warn" | "bad" }[] = [
    { label: "In fleet", value: s.inFleet, href: "/admin/vehicles" },
    { label: "Available", value: s.available, href: "/admin/vehicles?status=AVAILABLE" },
    { label: "On rent", value: s.onRent, href: "/admin/rentals?status=OPEN" },
    { label: "Leaving today", value: s.leavingToday, href: "/admin/reservations" },
    { label: "Returning today", value: s.returningToday, href: "/admin/rentals?status=OPEN" },
    { label: "Overdue", value: s.overdue, href: "/admin/rentals?status=OPEN", tone: s.overdue ? "bad" : undefined },
    { label: "Rented today", value: s.rentedToday },
    { label: "Reservations tomorrow", value: s.rezTomorrow, href: "/admin/reservations" },
    { label: "No-shows", value: s.noShow, tone: s.noShow ? "warn" : undefined },
  ];

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="space-y-6 p-4 md:p-6">
        <section aria-label="Fleet status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {tiles.map((t) => {
            const body = (
              <Card className={cn("gap-1 py-3 transition-colors", t.href && "hover:border-primary/50")}>
                <CardContent className="px-3">
                  <div className="text-xs text-muted-foreground">{t.label}</div>
                  <div
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      t.tone === "bad" && "text-destructive",
                      t.tone === "warn" && "text-warning-foreground dark:text-warning",
                    )}
                  >
                    {t.value}
                  </div>
                </CardContent>
              </Card>
            );
            return t.href ? (
              <Link key={t.label} href={t.href}>
                {body}
              </Link>
            ) : (
              <div key={t.label}>{body}</div>
            );
          })}
        </section>
      </div>
    </>
  );
}
