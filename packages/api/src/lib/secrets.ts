import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption for secrets kept in the database (payment gateway keys): AES-256-GCM with a key derived from
 * PAYMENT_SECRETS_KEY (falls back to BETTER_AUTH_SECRET). Format: base64(iv | tag | ciphertext).
 * Changing the env key makes stored secrets unreadable — re-enter them in Settings > Payment Gateway.
 */
function key() {
  const k = process.env.PAYMENT_SECRETS_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!k) throw new Error("PAYMENT_SECRETS_KEY (or BETTER_AUTH_SECRET) must be set to store payment keys.");
  return createHash("sha256").update(k).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function decryptSecret(enc: string) {
  const raw = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/** "sk_test_…abcd" — enough to recognise a stored key without revealing it. */
export function maskSecret(enc: string | null) {
  if (!enc) return null;
  try {
    const s = decryptSecret(enc);
    return `${s.slice(0, s.indexOf("_", 3) + 1)}…${s.slice(-4)}`;
  } catch {
    return "unreadable — enter it again";
  }
}
