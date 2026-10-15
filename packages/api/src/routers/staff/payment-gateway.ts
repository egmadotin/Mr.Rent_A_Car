import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../../trpc";
import { audit } from "../../lib/audit";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/secrets";

const keyInput = (prefix: string, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || v.startsWith(prefix), `${label} should start with "${prefix}"`);

/** Settings > Payment Settings > Payment Gateway (Stripe). Admin only; secrets are write-only. */
export const paymentGatewayRouter = router({
  get: adminProcedure.query(async ({ ctx }) => {
    const g = await ctx.prisma.paymentGateway.findUnique({ where: { provider: "STRIPE" } });
    return {
      isActive: g?.isActive ?? false,
      testMode: g?.testMode ?? true,
      publishableKey: g?.publishableKey ?? "",
      onlineMode: g?.onlineMode ?? "SAVE_CARD",
      secretKey: maskSecret(g?.secretKeyEnc ?? null),
      webhookSecret: maskSecret(g?.webhookSecretEnc ?? null),
      updatedAt: g?.updatedAt ?? null,
    };
  }),

  save: adminProcedure
    .input(
      z
        .object({
          isActive: z.boolean(),
          testMode: z.boolean(),
          publishableKey: z.string().trim().refine((v) => !v || v.startsWith("pk_"), 'Publishable key should start with "pk_"'),
          /** blank = keep the stored key */
          secretKey: keyInput("sk_", "Secret key").or(keyInput("rk_", "Secret key")),
          webhookSecret: keyInput("whsec_", "Webhook signing secret"),
          clearWebhookSecret: z.boolean().default(false),
          onlineMode: z.enum(["SAVE_CARD", "AUTHORIZE"]),
        })
        .superRefine((v, c) => {
          const mode = (k: string) => (k.includes("_test_") ? "test" : k.includes("_live_") ? "live" : null);
          for (const [k, path] of [[v.publishableKey, "publishableKey"], [v.secretKey ?? "", "secretKey"]] as const)
            if (k && mode(k) && mode(k) !== (v.testMode ? "test" : "live"))
              c.addIssue({ code: "custom", path: [path], message: `This is a ${mode(k)} key but Test mode is ${v.testMode ? "on" : "off"}.` });
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.prisma.paymentGateway.findUnique({ where: { provider: "STRIPE" } });
      if (input.isActive && (!input.publishableKey || !(input.secretKey || before?.secretKeyEnc)))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the publishable and secret keys before turning card payments on." });
      const data = {
        isActive: input.isActive,
        testMode: input.testMode,
        publishableKey: input.publishableKey || null,
        onlineMode: input.onlineMode,
        updatedById: ctx.user.id,
        ...(input.secretKey ? { secretKeyEnc: encryptSecret(input.secretKey) } : {}),
        ...(input.webhookSecret ? { webhookSecretEnc: encryptSecret(input.webhookSecret) } : input.clearWebhookSecret ? { webhookSecretEnc: null } : {}),
      };
      const g = await ctx.prisma.paymentGateway.upsert({ where: { provider: "STRIPE" }, update: data, create: { provider: "STRIPE", ...data } });
      await audit(ctx.prisma, "PaymentGateway", g.id, ctx.user.id, {
        Active: [before?.isActive ?? false, g.isActive],
        TestMode: [before?.testMode ?? true, g.testMode],
        PublishableKey: [before?.publishableKey ?? null, g.publishableKey],
        SecretKey: [null, input.secretKey ? "changed" : null],
        OnlineMode: [before?.onlineMode ?? null, g.onlineMode],
      });
      return { ok: true };
    }),

  /** "Test connection": the stored secret key can reach the Stripe account. */
  test: adminProcedure.mutation(async ({ ctx }) => {
    const g = await ctx.prisma.paymentGateway.findUnique({ where: { provider: "STRIPE" } });
    if (!g?.secretKeyEnc) throw new TRPCError({ code: "BAD_REQUEST", message: "Save a secret key first." });
    try {
      const stripe = new Stripe(decryptSecret(g.secretKeyEnc));
      const acct = await stripe.accounts.retrieve();
      return { ok: true, account: acct.settings?.dashboard?.display_name || acct.business_profile?.name || acct.id, chargesEnabled: acct.charges_enabled };
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Stripe rejected the key: ${(e as Error).message}` });
    }
  }),
});
