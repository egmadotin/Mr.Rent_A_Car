import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@mrac/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { ErpIcon } from "@mrac/ui/components/erp-icon";
import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { REPORT_CATEGORIES } from "./report-list";

export const metadata = { title: "Reports" };

/** RentCentric's Reports menu, by category; built reports open, the rest are marked. */
export default async function ReportsPage() {
  await requireStaff();
  const built = REPORT_CATEGORIES.flatMap((c) => c.reports).filter((r) => r.slug).length;
  const total = REPORT_CATEGORIES.flatMap((c) => c.reports).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Fleet & Financial Reports" description={`${built} of RentCentric's ${total} reports available`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {REPORT_CATEGORIES.map((c) => (
          <Card key={c.title} className="border-[#D5D5D5] bg-white shadow-xs">
            <CardHeader className="border-b border-[#D5D5D5]/60 bg-[#F4EFE6]/30 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ErpIcon name={c.icon} size={18} className="text-primary" />
                </span>
                <div>
                  <CardTitle className="font-serif text-base text-[#2D2C2C]">{c.title}</CardTitle>
                  <CardDescription className="line-clamp-1 text-xs text-[#575656]">{c.desc}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pt-2">
              <ul className="grid sm:grid-cols-2">
                {c.reports.map((r) =>
                  r.slug ? (
                    <li key={r.name}>
                      <Link href={`/admin/reports/${r.slug}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-[#2D2C2C] hover:bg-accent hover:text-primary">
                        {r.name} <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ) : (
                    <li key={r.name} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <span>{r.name}</span>
                      <Badge variant="muted">Not built yet</Badge>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
