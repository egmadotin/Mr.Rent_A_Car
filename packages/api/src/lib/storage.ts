import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { s3ConfigFromEnv, s3Delete, s3Get, s3Put } from "./s3";

/**
 * File storage for photos and documents (inspections, reported damages, vehicle images …).
 * Keys are opaque, e.g. `inspections/2026/10/<uuid>.jpg`. Files go to an S3-compatible bucket when S3_* is set (see
 * s3.ts — needed on hosts without a persistent disk, e.g. Vercel), else under UPLOAD_DIR (default `.uploads/` at the repo root).
 */

const ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd().replace(/[\\/](apps|packages)[\\/][^\\/]+$/, ""), ".uploads");

export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const FOLDERS = ["inspections", "damages", "vehicles", "customers", "rentals", "logos"] as const;
export type UploadFolder = (typeof FOLDERS)[number];
export const isUploadFolder = (f: string): f is UploadFolder => (FOLDERS as readonly string[]).includes(f);

/** A key is only ever `<folder>/<yyyy>/<mm>/<uuid>.<ext>` — anything else is refused (no path traversal). */
const KEY = /^(inspections|damages|vehicles|customers|rentals|logos)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|heic|pdf|doc|docx|xls|xlsx)$/;
export const isStorageKey = (k: string) => KEY.test(k);

export async function putFile(folder: UploadFolder, contentType: string, data: Uint8Array) {
  const ext = UPLOAD_TYPES[contentType];
  if (!ext) throw new Error("Unsupported file type");
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  const s3 = s3ConfigFromEnv();
  if (s3) {
    await s3Put(s3, key, data, contentType);
    return key;
  }
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return key;
}

export async function getFile(key: string) {
  if (!isStorageKey(key)) return null;
  try {
    const s3 = s3ConfigFromEnv();
    const data = s3 ? await s3Get(s3, key) : await readFile(path.join(ROOT, key));
    if (!data) return null;
    const ext = key.split(".").pop()!;
    return { data, contentType: Object.entries(UPLOAD_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  if (!isStorageKey(key)) return;
  const s3 = s3ConfigFromEnv();
  if (s3) await s3Delete(s3, key);
  else await rm(path.join(ROOT, key), { force: true });
}
