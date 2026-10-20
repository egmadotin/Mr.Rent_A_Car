import { createHash, createHmac } from "node:crypto";

/**
 * Minimal S3-compatible client (AWS S3, Cloudflare R2, Backblaze B2, MinIO …): PUT / GET / DELETE one object with
 * Signature V4, no SDK. Configured by S3_ENDPOINT (e.g. https://<account>.r2.cloudflarestorage.com), S3_REGION
 * (R2: "auto"), S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY. Path-style URLs: <endpoint>/<bucket>/<key>.
 */

export type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

export function s3ConfigFromEnv(): S3Config | null {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return { endpoint: S3_ENDPOINT.replace(/\/+$/, ""), region: S3_REGION || "auto", bucket: S3_BUCKET, accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY };
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

/** Signature V4 headers for one request (exported for tests). */
export function signRequest(cfg: S3Config, method: string, key: string, body: Uint8Array | null, contentType: string | null, now = new Date()) {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${encodeKey(key)}`);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? "");
  const headers: Record<string, string> = { host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [method, url.pathname, "", ...names.map((n) => `${n}:${headers[n]}`), "", names.join(";"), payloadHash].join("\n");
  const scope = `${day}/${cfg.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, day), cfg.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  delete headers.host;
  return { url: url.toString(), headers };
}

export async function s3Put(cfg: S3Config, key: string, data: Uint8Array, contentType: string) {
  const { url, headers } = signRequest(cfg, "PUT", key, data, contentType);
  const res = await fetch(url, { method: "PUT", headers, body: new Blob([new Uint8Array(data)]) });
  if (!res.ok) throw new Error(`File storage upload failed (${res.status})`);
}

export async function s3Get(cfg: S3Config, key: string) {
  const { url, headers } = signRequest(cfg, "GET", key, null, null);
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`File storage read failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function s3Delete(cfg: S3Config, key: string) {
  const { url, headers } = signRequest(cfg, "DELETE", key, null, null);
  const res = await fetch(url, { method: "DELETE", headers });
  if (!res.ok && res.status !== 404) throw new Error(`File storage delete failed (${res.status})`);
}
