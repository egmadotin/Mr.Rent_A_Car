import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRoundIcon, NotebookTabsIcon, PencilIcon, PrinterIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { LocalDateTime } from "@mrac/ui/components/local-time";
import { money } from "@mrac/ui/lib/format";
import { PageHeader } from "../../../../_components/page-header";
import { NoAccess } from "../../../../_components/no-access";
import { api, can } from "../../../../_lib/session";
import { QuoteMemo } from "./quote-memos";
import { SendQuoteDialogs } from "./send-dialogs";
import { PrintChargeTable } from "../../../print/_components/print-kit";

export const metadata = { title: "Quote" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await can("CheckViewQuote"))) return <NoAccess what="see quotes" />;
  const { id } = await params;
  const data = await (await api()).quote.byId({ quoteId: id }).catch(() => null);
  if (!data) notFound();
  const q = data.quote;
  // RentCentric SMS text uses "12/15/2024 12:00 PM" in the pickup location's zone
  const us = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: q.pickupLocation.timeZone, month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(d).replace(",", "");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Quotes", href: "/admin/quotes" }, { label: `#${q.number}` }]}
        title={`Quote#${q.number}`}
        actions={
          <>
            {/* same actions and labels as RentCentric QuoteMain.aspx */}
            {(await can("CheckEditkOuote")) && <Button variant="outline" asChild><Link href={`/admin/quotes/${q.id}/edit`}><PencilIcon /> Edit</Link></Button>}
            <SendQuoteDialogs
              quoteId={q.id}
              firstName={q.firstName ?? q.customer?.firstName ?? ""}
              lastName={q.lastName ?? q.customer?.lastName ?? ""}
              email={q.email ?? q.customer?.email ?? ""}
              phone={q.contactPhone ?? q.customer?.phone ?? ""}
              smsText={`Quote: ${q.number}, From ${q.pickupLocation.name}, Vehicle ${q.vehicleType.name}, Date: ${us(q.pickupAt)} to ${us(q.returnAt)}, Total ${money(data.total)}, Phone: ${(q.pickupLocation.phone ?? "").replace(/\D/g, "")}, Website:http://www.mrrentacar.com`}
            />
            <Button variant="outline" asChild><Link href={`/admin/print/quotes/${q.id}`} target="_blank"><PrinterIcon /> Print Quote</Link></Button>
            {(await can("ReservationsAdd")) && <Button asChild><Link href={`/admin/reservations/new?quoteId=${q.id}`}><NotebookTabsIcon /> Make New Reservation</Link></Button>}
            {(await can("ReservationsAdd", "CheckOuts")) && <Button variant="outline" asChild><Link href={`/admin/reservations/new?quoteId=${q.id}&start=1`}><KeyRoundIcon /> Start Rental</Link></Button>}
          </>
        }
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          {/* the ten fields of RentCentric QuoteMain.aspx, in its two-column order */}
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
                {(
                  [
                    ["Quote Date", <LocalDateTime key="d" value={q.createdAt} timeZone={q.pickupLocation.timeZone} />],
                    ["By", q.createdBy?.name],
                    ["Pickup Date", <LocalDateTime key="p" value={q.pickupAt} timeZone={q.pickupLocation.timeZone} />],
                    ["Return Location", q.returnLocation.name],
                    ["Customer Name", q.customer ? <Link key="c" href={`/admin/customers/${q.customer.id}`} className="text-primary hover:underline">{q.customer.firstName} {q.customer.lastName}</Link> : q.contactName],
                    ["Company", q.company?.name ?? "N/A"],
                    ["Return Date", <LocalDateTime key="r" value={q.returnAt} timeZone={q.pickupLocation.timeZone} />],
                    ["Equipment Type", q.vehicleType.name],
                    ["Pickup Location", q.pickupLocation.name],
                    ["Total", money(data.total)],
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
                    <dt className="text-muted-foreground">{k}:</dt>
                    <dd>{v === null || v === undefined || v === "" ? "—" : v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <QuoteMemo quoteId={q.id} memo={q.memos[0]?.body ?? ""} />
        </div>
        <Card className="gap-2 pb-0">
          <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
          <div className="px-4 pb-4"><PrintChargeTable lines={q.chargeLines} timeLabel="Total T&KM" /></div>
        </Card>
      </div>
    </>
  );
}
