"use client";

import * as React from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeElementsOptions } from "@stripe/stripe-js";

/** Returns the confirmed intent id, or throws with a message for the customer. */
export type ConfirmCard = (prepare: () => Promise<{ kind: "setup" | "payment"; clientSecret: string; intentId: string }>) => Promise<string>;

const stripes = new Map<string, Promise<Stripe | null>>();
const stripeFor = (pk: string) => {
  if (!stripes.has(pk)) stripes.set(pk, loadStripe(pk));
  return stripes.get(pk)!;
};

/**
 * Stripe's card field (in place of the live site's Credit Card Type / Number / Card Holder / CVV / Expiry): the card goes
 * straight to Stripe. `confirmRef` gets a function Reserve calls: validate → prepare the intent on our server → confirm.
 */
export function CardField({
  publishableKey,
  mode,
  amountCents,
  confirmRef,
}: {
  publishableKey: string;
  mode: "SAVE_CARD" | "AUTHORIZE";
  amountCents: number;
  confirmRef: React.RefObject<ConfirmCard | null>;
}) {
  const options: StripeElementsOptions =
    mode === "AUTHORIZE"
      ? { mode: "payment", amount: Math.max(50, amountCents), currency: "cad", captureMethod: "manual", setupFutureUsage: "off_session", paymentMethodTypes: ["card"] }
      : { mode: "setup", currency: "cad", setupFutureUsage: "off_session", paymentMethodTypes: ["card"] };
  return (
    <Elements stripe={stripeFor(publishableKey)} options={options}>
      <Inner confirmRef={confirmRef} />
    </Elements>
  );
}

function Inner({ confirmRef }: { confirmRef: React.RefObject<ConfirmCard | null> }) {
  const stripe = useStripe();
  const elements = useElements();
  React.useEffect(() => {
    confirmRef.current = async (prepare) => {
      if (!stripe || !elements) throw new Error("The card form is still loading. Please try again.");
      const { error: invalid } = await elements.submit();
      if (invalid) throw new Error(invalid.message ?? "Check your card details.");
      const { kind, clientSecret, intentId } = await prepare();
      const confirmParams = { return_url: window.location.href };
      const { error } =
        kind === "payment"
          ? await stripe.confirmPayment({ elements, clientSecret, confirmParams, redirect: "if_required" })
          : await stripe.confirmSetup({ elements, clientSecret, confirmParams, redirect: "if_required" });
      if (error) throw new Error(error.message ?? "Your card was declined.");
      return intentId;
    };
    return () => {
      confirmRef.current = null;
    };
  }, [stripe, elements, confirmRef]);
  return <PaymentElement options={{ layout: "tabs" }} />;
}
