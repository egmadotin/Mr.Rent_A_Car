import { PageHeader } from "../../../_components/page-header";
import { requireStaff } from "../../../_lib/session";
import { TasksScreen } from "./tasks-screen";

export const metadata = { title: "Tasks" };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Tasks" description="My Tasks, and the Tasks List with filters (RentCentric Tasks & Messages)." />
      <TasksScreen />
    </>
  );
}
