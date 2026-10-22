import { createHmac, timingSafeEqual } from "node:crypto";

/** Signed unsubscribe links for marketing emails: /unsubscribe?c=<customer id>&t=<HMAC of the id>. */
function sign(customerId: string) {
  const k = process.env.BETTER_AUTH_SECRET;
  if (!k) throw new Error("BETTER_AUTH_SECRET must be set to sign unsubscribe links.");
  return createHmac("sha256", k).update(`unsubscribe:${customerId}`).digest("base64url");
}

export function unsubscribeUrl(customerId: string) {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";
  return new URL(`/unsubscribe?c=${encodeURIComponent(customerId)}&t=${sign(customerId)}`, base).href;
}

export function checkUnsubscribe(customerId: string, token: string) {
  const a = Buffer.from(sign(customerId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
