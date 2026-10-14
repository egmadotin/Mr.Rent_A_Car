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

/** The location the staff member is working in (sidebar picker cookie, else their default location). */
export async function workingLocationId() {
  const session = await requireStaff();
  return (await cookies()).get(LOCATION_COOKIE)?.value ?? session.user.defaultLocationId ?? undefined;
}
