import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  const error = new Error("Stripe payment configuration is unavailable.");
  error.name = "StripeConfigurationError";
  throw Object.assign(error, { issue: "missing" as const });
}

export function assertStripeTestMode(): void {
  if (!secretKey?.startsWith("sk_test_")) {
    const error = new Error("Stripe payment configuration is unavailable.");
    error.name = "StripeConfigurationError";
    throw Object.assign(error, { issue: "test_mode_required" as const });
  }
}

export const stripe = new Stripe(secretKey);
