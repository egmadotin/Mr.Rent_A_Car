import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isStaff } from "@mrac/auth";
import { serverApi } from "@mrac/api/server";

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
