import Stripe from "stripe";
import {
  beginBookingPaymentAttempt,
  ensureBookingPayments,
  finishBookingPaymentAttempt,
  getBookingPaymentById,
  getBookingPaymentsForRequest,
  getRequestById,
  markBookingPaymentManualReview,
  markDepositForManualReview,
  recordBookingPaymentStripeObject,
  setBookingPaymentsPending,
  updateBookingPaymentFromIntent,
} from "@/lib/data/queries";
import { stripe, assertStripeTestMode } from "@/lib/stripe";
import type { BookingPayment } from "@/lib/types";
import {
  isPaymentAttemptStale,
  automaticRefundKindForReturn,
  paymentStatusForStripeResult,
  shouldChargeBookingPayment,
  shouldRefundForCancellation,
} from "@/lib/booking-payment";

export interface PaymentWorkflowResult {
  payments: BookingPayment[];
  awaitingPaymentMethod: boolean;
  unresolved: boolean;
}

export async function chargeApprovedBooking(
  requestId: string,
  retryFailed = false
): Promise<PaymentWorkflowResult> {
  const request = await getRequestById(requestId);
  if (!request || request.status !== "approved") {
    throw new Error("Payments can only be charged for an approved request.");
  }
  const payments = await ensureBookingPayments(requestId);
  if (payments.length === 0) {
    return { payments, awaitingPaymentMethod: false, unresolved: false };
  }
  if (!request.stripeCustomerId || !request.stripePaymentMethodId) {
    return { payments, awaitingPaymentMethod: payments.length > 0, unresolved: false };
  }

  assertStripeTestMode();
  await setBookingPaymentsPending(requestId);
  for (const payment of payments) {
    if (!shouldChargeBookingPayment(payment.status, retryFailed)) continue;
    await chargeOnePayment(payment.id, requestId, request.stripeCustomerId, request.stripePaymentMethodId);
    const current = await getRequestById(requestId);
    if (current?.status === "cancelled") {
      await refundBookingPayments(requestId, "cancellation");
      break;
    }
  }

  const latest = await getBookingPaymentsForRequest(requestId);
  return {
    payments: latest,
    awaitingPaymentMethod: false,
    unresolved: latest.some((payment) => payment.status === "processing" || payment.status === "manual_review"),
  };
}

async function chargeOnePayment(
  paymentId: string,
  requestId: string,
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  const attempt = await beginBookingPaymentAttempt(paymentId, "charge");
  if (!attempt) return;
  if (!attempt.stripeObjectId && isPaymentAttemptStale(attempt.createdAt)) {
    await markBookingPaymentManualReview(paymentId, "Charge attempt is too old to retry safely; reconcile it in Stripe first.");
    return;
  }

  let intent: Stripe.PaymentIntent;
  try {
    const payment = await getBookingPaymentById(paymentId);
    if (!payment) throw new Error(`Booking payment ${paymentId} no longer exists.`);
    intent = attempt.stripeObjectId
      ? await stripe.paymentIntents.retrieve(attempt.stripeObjectId)
      : await stripe.paymentIntents.create({
          amount: payment.amountCents,
          currency: "aud",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          metadata: { bookingPaymentId: paymentId, requestId },
        }, { idempotencyKey: attempt.idempotencyKey });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      const paymentIntent = error.payment_intent;
      if (paymentIntent && typeof paymentIntent !== "string") {
        await recordBookingPaymentStripeObject(attempt.id, paymentIntent.id);
      }
      await finishBookingPaymentAttempt(attempt.id, "failed", error.message);
      return;
    }
    await finishBookingPaymentAttempt(
      attempt.id,
      "uncertain",
      "Stripe charge outcome is not confirmed; retry will reuse the same idempotency key."
    );
    console.error("Booking payment outcome is uncertain.", { requestId, paymentId, error });
    return;
  }

  const recorded = await recordBookingPaymentStripeObject(attempt.id, intent.id);
  if (!recorded) {
    await finishBookingPaymentAttempt(attempt.id, "uncertain", "PaymentIntent could not be linked to its attempt.");
    throw new Error(`PaymentIntent ${intent.id} could not be linked to payment ${paymentId}.`);
  }
  const result = paymentStatusForStripeResult("charge", intent.status);
  await finishBookingPaymentAttempt(
    attempt.id,
    result === "succeeded" ? "succeeded" : result === "failed" ? "failed" : "uncertain",
    result === "failed" ? `Stripe reported ${intent.status}.` : null
  );
}

export async function refundBookingPayments(
  requestId: string,
  reason: "satisfactory_return" | "cancellation",
  paymentKind?: BookingPayment["kind"],
  allowManualReview = false
): Promise<PaymentWorkflowResult> {
  const payments = await getBookingPaymentsForRequest(requestId);
  const targets = payments.filter((payment) => {
    if (paymentKind && payment.kind !== paymentKind) return false;
    return shouldRefundForCancellation(payment.status) ||
      payment.status === "refund_pending" ||
      (allowManualReview && payment.status === "manual_review");
  });
  if (targets.length === 0) {
    return { payments, awaitingPaymentMethod: false, unresolved: false };
  }
  assertStripeTestMode();

  for (const payment of targets) {
    const attempt = await beginBookingPaymentAttempt(payment.id, "refund");
    if (!attempt) continue;
    if (!attempt.stripeObjectId && isPaymentAttemptStale(attempt.createdAt)) {
      await markBookingPaymentManualReview(payment.id, "Refund attempt is too old to retry safely; reconcile it in Stripe first.");
      continue;
    }

    if (!payment.stripePaymentIntentId) {
      await finishBookingPaymentAttempt(attempt.id, "failed", "PaymentIntent ID is missing; refund requires manual review.");
      continue;
    }
    try {
      const refund = attempt.stripeObjectId
        ? await stripe.refunds.retrieve(attempt.stripeObjectId)
        : await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            metadata: { bookingPaymentId: payment.id, requestId, reason },
          }, { idempotencyKey: attempt.idempotencyKey });
      const recorded = await recordBookingPaymentStripeObject(attempt.id, refund.id);
      if (!recorded) {
        await finishBookingPaymentAttempt(attempt.id, "uncertain", "Stripe refund could not be linked to its attempt.");
        continue;
      }
      const result = paymentStatusForStripeResult("refund", refund.status ?? "pending");
      await finishBookingPaymentAttempt(
        attempt.id,
        result === "refunded" ? "succeeded" : result === "refund_failed" ? "failed" : "uncertain",
        result === "refund_failed" ? `Stripe refund status: ${refund.status}.` : null
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        await finishBookingPaymentAttempt(attempt.id, "failed", error.message);
      } else {
        await finishBookingPaymentAttempt(
          attempt.id,
          "uncertain",
          "Stripe refund outcome is not confirmed; retry will reuse the same idempotency key."
        );
      }
      console.error("Booking payment refund did not complete.", { requestId, paymentId: payment.id, reason, error });
    }
  }

  const latest = await getBookingPaymentsForRequest(requestId);
  return {
    payments: latest,
    awaitingPaymentMethod: false,
    unresolved: latest.some((payment) =>
      payment.status === "refund_pending" || payment.status === "processing" || payment.status === "manual_review"
    ),
  };
}

export async function reconcilePaymentIntent(intent: Stripe.PaymentIntent): Promise<void> {
  const paymentId = intent.metadata.bookingPaymentId;
  const result = await updateBookingPaymentFromIntent(
    intent.id,
    intent.status,
    paymentId || undefined
  );
  if (!result) return;
  const request = await getRequestById(result.requestId);
  if (request?.status === "cancelled" && result.status === "succeeded") {
    await refundBookingPayments(result.requestId, "cancellation");
  }
}

export async function handleRecordedReturn(
  requestId: string,
  condition: string
): Promise<PaymentWorkflowResult | null> {
  const payments = await getBookingPaymentsForRequest(requestId);
  const deposit = payments.find((payment) => payment.kind === "deposit");
  if (!deposit || deposit.status !== "succeeded") return null;
  if (!automaticRefundKindForReturn(deposit.kind, condition)) {
    await markDepositForManualReview(
      requestId,
      `Return condition "${condition}" requires an authorized manual deposit review.`
    );
    return {
      payments: await getBookingPaymentsForRequest(requestId),
      awaitingPaymentMethod: false,
      unresolved: true,
    };
  }
  return refundBookingPayments(requestId, "satisfactory_return", "deposit");
}
