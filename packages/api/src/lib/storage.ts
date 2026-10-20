import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage for photos and documents (inspections, reported damages, vehicle images …).
 * Files live under UPLOAD_DIR (default: `.uploads/` at the repo root). Keys are opaque, e.g. `inspections/2026/10/<uuid>.jpg`.
 * TODO deploy: hosts without a persistent disk (Vercel) need an S3-compatible driver behind the same three functions.
 */

const ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd().replace(/[\\/](apps|packages)[\\/][^\\/]+$/, ""), ".uploads");

export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const FOLDERS = ["inspections", "damages", "vehicles", "customers", "rentals"] as const;
export type UploadFolder = (typeof FOLDERS)[number];
export const isUploadFolder = (f: string): f is UploadFolder => (FOLDERS as readonly string[]).includes(f);

/** A key is only ever `<folder>/<yyyy>/<mm>/<uuid>.<ext>` — anything else is refused (no path traversal). */
const KEY = /^(inspections|damages|vehicles|customers|rentals)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|heic|pdf)$/;
export const isStorageKey = (k: string) => KEY.test(k);

export async function putFile(folder: UploadFolder, contentType: string, data: Uint8Array) {
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) throw new Error("Unsupported file type");
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return key;
}

export async function getFile(key: string) {
  if (!isStorageKey(key)) return null;
  try {
    const data = await readFile(path.join(ROOT, key));
    const ext = key.split(".").pop()!;
    return { data, contentType: Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  if (isStorageKey(key)) await rm(path.join(ROOT, key), { force: true });
}
