import Link from "next/link";
import { cookies } from "next/headers";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { LOCATION_COOKIE } from "../../../_lib/cookies";
import { requireStaff } from "../../../_lib/session";
import { QuotesList } from "./quotes-list";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const session = await requireStaff();
  // Advanced Search "Location" defaults to the working location, as in RentCentric
  const locationId = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
  return (
    <>
      <PageHeader
        title="Quotes"
        actions={<Button asChild><Link href="/admin/quotes/new"><PlusIcon /> New Quotes</Link></Button>}
      />
      <QuotesList defaultLocationId={locationId} />
    </>
  );
}
