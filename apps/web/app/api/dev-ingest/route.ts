// TEMPORARY dev-only helper used to copy reference data from the legacy ERP. Delete after import.
import { writeFile, mkdir } from "node:fs/promises";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("off", { status: 404 });
  const name = new URL(req.url).searchParams.get("name")?.replace(/[^a-z0-9_-]/gi, "") || "data";
  await mkdir("/tmp/legacy", { recursive: true });
  await writeFile(`/tmp/legacy/${name}.json`, await req.text());
  return new Response("ok", { headers: { "access-control-allow-origin": "*" } });
}
