import { cookies } from "next/headers";
import { Sidebar } from "../../_components/shell/sidebar";
import { LOCATION_COOKIE, SIDEBAR_COOKIE } from "../../_lib/cookies";
import { api, requireStaff } from "../../_lib/session";

/** Authenticated ERP shell: persistent, collapsible left sidebar + content. */
export default async function ErpAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const jar = await cookies();
  const locations = await (await api()).meta.activeLocations();
  const currentLocationId =
    jar.get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? locations[0]?.id ?? null;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        user={{ name: session.user.name, email: session.user.email }}
        locations={locations}
        currentLocationId={currentLocationId}
        defaultCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "1"}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
