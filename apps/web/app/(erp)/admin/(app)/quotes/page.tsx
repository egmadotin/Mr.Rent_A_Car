import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { NoAccess } from "../../../_components/no-access";
import { can, workingLocationId } from "../../../_lib/session";
import { QuotesList } from "./quotes-list";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  if (!(await can("CheckViewQuote"))) return <NoAccess what="see quotes" />;
  // Advanced Search "Location" defaults to the working location, as in RentCentric
  const locationId = await workingLocationId();
  return (
    <>
      <PageHeader
        title="Quotes"
        actions={(await can("CheckAddQuote")) ? <Button asChild><Link href="/admin/quotes/new"><PlusIcon /> New Quotes</Link></Button> : undefined}
      />
      <QuotesList defaultLocationId={locationId} />
    </>
  );
}
