import "server-only";
import { headers } from "next/headers";
import { serverApi } from "@mrac/api/server";

/** Public (customer) procedures for Server Components — same surface the mobile app will use. */
export async function publicApi() {
  return (await serverApi(await headers())).customer;
}
