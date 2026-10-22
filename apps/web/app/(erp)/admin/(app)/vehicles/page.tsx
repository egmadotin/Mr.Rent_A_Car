import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { PageHeader } from "../../../_components/page-header";
import { NoAccess } from "../../../_components/no-access";
import { can, requireStaff } from "../../../_lib/session";
import { VehiclesList } from "./vehicles-list";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!(await can("Vehicles"))) return <NoAccess what="see vehicles" />;
  await requireStaff();
  const { status } = await searchParams;
  return (
    <>
      <PageHeader
        title="Vehicles"
        actions={
          (await can("VehiclesAdd")) ? (
            <Button asChild>
              <Link href="/admin/vehicles/new">
                <PlusIcon /> Add vehicle
              </Link>
            </Button>
          ) : undefined
        }
      />
      <VehiclesList initialStatus={status} />
    </>
  );
}
