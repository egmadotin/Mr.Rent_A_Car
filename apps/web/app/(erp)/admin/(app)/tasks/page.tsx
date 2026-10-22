import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { TasksScreen } from "./tasks-screen";

export const metadata = { title: "My Tasks" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="My Tasks" description="Tasks assigned to you, and the Tasks List with filters (RentCentric Tasks & Messages)." />
      <TasksScreen />
    </>
  );
}
