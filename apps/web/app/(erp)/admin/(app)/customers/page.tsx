import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { CustomersList } from "./customers-list";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Customers" actions={<Button asChild><Link href="/admin/customers/new"><PlusIcon /> Add customer</Link></Button>} />
      <CustomersList />
    </>
  );
}
