import { auth, isStaff } from "@mrac/auth";
import { getFile } from "@mrac/api/storage";

/** Serve an uploaded file to staff: /api/files/<key>. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !isStaff(session.user)) return new Response("Not signed in", { status: 401 });
  const f = await getFile((await params).key.join("/"));
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), { headers: { "content-type": f.contentType, "cache-control": "private, max-age=31536000, immutable" } });
}
