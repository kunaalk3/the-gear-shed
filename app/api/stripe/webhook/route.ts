import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { saveStripePaymentMethod, getRequestById } from "@/lib/data/queries";
import { notifyUser } from "@/lib/notify";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "setup" && session.metadata?.requestId) {
      const requestId = session.metadata.requestId;
      const customerId = session.customer as string;
      const setupIntentId = session.setup_intent as string;
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      const paymentMethodId = setupIntent.payment_method as string;

      await saveStripePaymentMethod(requestId, customerId, paymentMethodId);

      const existing = await getRequestById(requestId);
      if (existing) {
        await notifyUser(
          existing.userId,
          "payment_method_saved",
          "Your card is on file for your approved loan.",
          "/my-requests"
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
