import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@mrac/db";
import { decryptSecret } from "./secrets";

type Db = Prisma.TransactionClient;

/** The active Stripe gateway (Settings > Payment Gateway), or null when card payments aren't set up. */
export async function stripeGateway(db: Db) {
  const g = await db.paymentGateway.findUnique({ where: { provider: "STRIPE" } });
  if (!g?.isActive || !g.publishableKey || !g.secretKeyEnc) return null;
  return {
    publishableKey: g.publishableKey,
    onlineMode: g.onlineMode === "AUTHORIZE" ? ("AUTHORIZE" as const) : ("SAVE_CARD" as const),
    stripe: new Stripe(decryptSecret(g.secretKeyEnc)),
  };
}

export async function requireStripe(db: Db) {
  const g = await stripeGateway(db);
  if (!g) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Card payments aren't set up yet." });
  return g;
}

/** Card summary of a confirmed Setup/Payment Intent's payment method, for the CreditCard record. */
export async function cardOf(stripe: Stripe, paymentMethodId: string) {
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  const c = pm.card;
  return {
    brand: c?.brand ? c.brand[0]!.toUpperCase() + c.brand.slice(1) : "Card",
    last4: c?.last4 ?? "????",
    expMonth: c?.exp_month ?? 0,
    expYear: c?.exp_year ?? 0,
    holderName: pm.billing_details?.name ?? null,
  };
}
