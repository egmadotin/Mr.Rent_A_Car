import { cookies } from "next/headers";
import { Sidebar } from "../../_components/shell/sidebar";
import { SIDEBAR_COOKIE } from "../../_lib/cookies";
import { myLocations, myPermissions, requireStaff, workingLocationId } from "../../_lib/session";

/** Authenticated ERP shell: persistent, collapsible left sidebar + content. */
export default async function ErpAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const jar = await cookies();
  // the sidebar's location picker lists only the branches the user has access to
  const locations = await myLocations();
  const currentLocationId = (await workingLocationId()) ?? null;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        user={{ name: session.user.name, email: session.user.email }}
        locations={locations}
        currentLocationId={currentLocationId}
        defaultCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "1"}
        permissions={[...(await myPermissions())]}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
