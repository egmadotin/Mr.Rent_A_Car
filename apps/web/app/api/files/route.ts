import { auth, isStaff } from "@mrac/auth";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, isUploadFolder, putFile } from "@mrac/api/storage";

/**
 * Staff file upload (multipart: `file`, `folder`). Returns the storage key; the record that uses the file (an inspection,
 * a reported damage …) is saved through tRPC with that key.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !isStaff(session.user)) return Response.json({ error: "Not signed in" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = String(form?.get("folder") ?? "");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!isUploadFolder(folder)) return Response.json({ error: "Unknown folder" }, { status: 400 });
  if (!UPLOAD_TYPES[file.type]) return Response.json({ error: "Only photos (JPG, PNG, WebP, GIF, HEIC), PDF, Word and Excel files" }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File is larger than 15 MB" }, { status: 413 });
  const key = await putFile(folder, file.type, new Uint8Array(await file.arrayBuffer()));
  return Response.json({ key, fileName: file.name, contentType: file.type, sizeBytes: file.size });
}
