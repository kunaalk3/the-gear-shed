import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  saveStripePaymentMethod,
  getRequestById,
  updateBookingPaymentFromRefund,
} from "@/lib/data/queries";
import { notifyUserOnce } from "@/lib/notify";
import { stripeWebhookNotificationId } from "@/lib/payment-idempotency";
import { assertStripeTestMode } from "@/lib/stripe";
import { chargeApprovedBooking, reconcilePaymentIntent } from "@/lib/booking-payment-workflow";

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
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : null;
      if (!customerId || !setupIntentId) {
        return NextResponse.json({ error: "Completed setup session is missing Stripe references." }, { status: 500 });
      }
      assertStripeTestMode();
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;
      if (!paymentMethodId) {
        return NextResponse.json({ error: "Completed setup intent has no payment method." }, { status: 500 });
      }

      await saveStripePaymentMethod(requestId, customerId, paymentMethodId);
      await chargeApprovedBooking(requestId);

      const existing = await getRequestById(requestId);
      if (existing) {
        await notifyUserOnce(
          stripeWebhookNotificationId(event.id),
          existing.userId,
          "payment_method_saved",
          "Your card is on file for your approved loan.",
          "/my-requests"
        );
      }
    }
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    await reconcilePaymentIntent(event.data.object as Stripe.PaymentIntent);
  }
  if (event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    await updateBookingPaymentFromRefund(refund.id, refund.status ?? "pending");
  }

  return NextResponse.json({ received: true });
}
