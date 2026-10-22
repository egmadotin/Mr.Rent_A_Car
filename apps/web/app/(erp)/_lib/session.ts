import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isStaff } from "@mrac/auth";
import { serverApi } from "@mrac/api/server";
import { LOCATION_COOKIE } from "./cookies";

/** Server-side staff guard. Every ERP page and the (app) layout go through this. */
export const requireStaff = cache(async () => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session) redirect("/admin/login");
  if (!isStaff(session.user)) redirect("/admin/login?error=forbidden");
  return session;
});

/** tRPC caller for Server Components, bound to the current request. */
export const api = cache(async () => {
  await requireStaff();
  return (await serverApi(await headers())).staff;
});

/** The active locations this staff member may work in (Settings › Users › Location Access; Full Admins: all). */
export const myLocations = cache(async () => {
  const a = await api();
  const [locations, me] = await Promise.all([a.meta.activeLocations(), a.users.me()]);
  return me.locationIds ? locations.filter((l) => me.locationIds!.includes(l.id)) : locations;
});

/** The location the staff member is working in (sidebar picker cookie, else their default location) — one they have access to. */
export async function workingLocationId() {
  const session = await requireStaff();
  const mine = await myLocations();
  const wanted = (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId;
  return mine.find((l) => l.id === wanted)?.id ?? mine[0]?.id;
}

/** The signed-in staff member's permissions (group ± their own changes; Full Admins: all), for hiding what they can't do. */
export const myPermissions = cache(async () => new Set((await (await api()).users.me()).permissions));

/** Server Components: whether the staff member holds every listed permission. */
export async function can(...perms: string[]) {
  const mine = await myPermissions();
  return perms.every((p) => mine.has(p));
}
