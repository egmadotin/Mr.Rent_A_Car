import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { NoAccess } from "../../../_components/no-access";
import { can, requireStaff } from "../../../_lib/session";
import { CustomersList } from "./customers-list";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  if (!(await can("Customers"))) return <NoAccess what="see customers" />;
  await requireStaff();
  return (
    <>
      <PageHeader title="Customers" actions={(await can("CustomersAdd")) ? <Button asChild><Link href="/admin/customers/new"><PlusIcon /> Add customer</Link></Button> : undefined} />
      <CustomersList />
    </>
  );
}
