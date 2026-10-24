import assert from "node:assert/strict";
import test from "node:test";
import {
  depositChargeIdempotencyKey,
  depositChargeNotificationId,
  isDefinitiveFailedPaymentIntent,
  isDepositChargeAttemptStale,
  isSuccessfulPaymentIntent,
  notifyAfterSuccessfulDepositCharge,
  stripeWebhookNotificationId,
} from "./payment-idempotency.ts";

test("a deposit charge attempt always reuses its own Stripe idempotency key", () => {
  assert.equal(depositChargeIdempotencyKey("attempt-1"), "deposit-charge-attempt-1");
  assert.equal(depositChargeIdempotencyKey("attempt-1"), depositChargeIdempotencyKey("attempt-1"));
  assert.notEqual(depositChargeIdempotencyKey("attempt-1"), depositChargeIdempotencyKey("attempt-2"));
});

test("payment is successful only when Stripe reports succeeded", () => {
  assert.equal(isSuccessfulPaymentIntent("succeeded"), true);
  assert.equal(isSuccessfulPaymentIntent("processing"), false);
  assert.equal(isSuccessfulPaymentIntent("requires_action"), false);
});

test("only terminal unsuccessful intents are recorded as failed", () => {
  assert.equal(isDefinitiveFailedPaymentIntent("requires_payment_method"), true);
  assert.equal(isDefinitiveFailedPaymentIntent("requires_action"), true);
  assert.equal(isDefinitiveFailedPaymentIntent("canceled"), true);
  assert.equal(isDefinitiveFailedPaymentIntent("processing"), false);
  assert.equal(isDefinitiveFailedPaymentIntent("requires_capture"), false);
});

test("an old or invalid in-progress attempt is not retried automatically", () => {
  const now = Date.parse("2026-10-22T12:00:00.000Z");
  assert.equal(
    isDepositChargeAttemptStale("2026-10-22T11:00:00.000Z", now),
    false
  );
  assert.equal(
    isDepositChargeAttemptStale("2026-10-21T12:59:59.000Z", now),
    true
  );
  assert.equal(isDepositChargeAttemptStale("invalid", now), true);
});

test("a notification failure after a successful charge is contained", async () => {
  const failures = [];
  await assert.doesNotReject(
    notifyAfterSuccessfulDepositCharge(
      async () => {
        throw new Error("notification unavailable");
      },
      (error) => failures.push(error)
    )
  );
  assert.equal(failures.length, 1);
});

test("payment notifications have deterministic IDs for retries", () => {
  assert.equal(depositChargeNotificationId("attempt-1"), "deposit-charge-notification-attempt-1");
  assert.equal(depositChargeNotificationId("attempt-1"), depositChargeNotificationId("attempt-1"));
  assert.equal(stripeWebhookNotificationId("evt_123"), "stripe-webhook-evt_123");
  assert.equal(stripeWebhookNotificationId("evt_123"), stripeWebhookNotificationId("evt_123"));
});
