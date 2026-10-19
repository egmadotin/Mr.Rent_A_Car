import { PageHeader } from "../../../../_components/page-header";
import { requireStaff } from "../../../../_lib/session";
import { Companies } from "../_components/setup-settings";

export const metadata = { title: "Companies / Corporates" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Companies / Corporates" description="Corporate, insurance and partner accounts that can be billed for rentals." breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Company" }, { label: "Companies / Corporates" }]} />
      <Companies />
    </>
  );
}
