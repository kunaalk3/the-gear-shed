import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateHireFeeCents,
  automaticRefundKindForReturn,
  isPaymentAttemptStale,
  paymentStatusForStripeResult,
  qualifiesForAutomaticDepositRefund,
  shouldChargeBookingPayment,
  shouldCollectDeposit,
  shouldRefundForCancellation,
} from "./booking-payment.ts";

test("hire fee uses inclusive calendar days and quantity", () => {
  assert.equal(calculateHireFeeCents(12, "2026-10-24", "2026-10-24", 1), 1200);
  assert.equal(calculateHireFeeCents(12, "2026-10-24", "2026-10-26", 3), 10800);
});

test("hire fee rejects invalid dates, reversed ranges and invalid amounts", () => {
  assert.throws(() => calculateHireFeeCents(12, "2026-02-30", "2026-03-01", 1), RangeError);
  assert.throws(() => calculateHireFeeCents(12, "2026-10-25", "2026-10-24", 1), RangeError);
  assert.throws(() => calculateHireFeeCents(-1, "2026-10-24", "2026-10-24", 1), RangeError);
  assert.throws(() => calculateHireFeeCents(12, "2026-10-24", "2026-10-24", 0), RangeError);
});

test("only excellent and good returns qualify for automatic deposit refund", () => {
  assert.equal(qualifiesForAutomaticDepositRefund("excellent"), true);
  assert.equal(qualifiesForAutomaticDepositRefund("good"), true);
  assert.equal(qualifiesForAutomaticDepositRefund("fair"), false);
  assert.equal(qualifiesForAutomaticDepositRefund("poor"), false);
  assert.equal(qualifiesForAutomaticDepositRefund("unknown"), false);
});

test("deposits are only collected for transactions with a return lifecycle", () => {
  assert.equal(shouldCollectDeposit("paid_hire"), true);
  assert.equal(shouldCollectDeposit("temporary_free_loan"), true);
  assert.equal(shouldCollectDeposit("permanent_donation"), false);
});

test("cancellation refunds successful payments and allows retry after refund failure", () => {
  assert.equal(shouldRefundForCancellation("succeeded"), true);
  assert.equal(shouldRefundForCancellation("refund_failed"), true);
  assert.equal(shouldRefundForCancellation("awaiting_payment_method"), false);
  assert.equal(shouldRefundForCancellation("processing"), false);
  assert.equal(shouldRefundForCancellation("refunded"), false);
});

test("payment states distinguish successful, failed and uncertain Stripe outcomes", () => {
  assert.equal(paymentStatusForStripeResult("charge", "succeeded"), "succeeded");
  assert.equal(paymentStatusForStripeResult("charge", "requires_payment_method"), "failed");
  assert.equal(paymentStatusForStripeResult("charge", "processing"), "processing");
  assert.equal(paymentStatusForStripeResult("refund", "succeeded"), "refunded");
  assert.equal(paymentStatusForStripeResult("refund", "failed"), "refund_failed");
  assert.equal(paymentStatusForStripeResult("refund", "pending"), "refund_pending");
});

test("failed payments are charged again only after an explicit retry", () => {
  assert.equal(shouldChargeBookingPayment("pending", false), true);
  assert.equal(shouldChargeBookingPayment("failed", false), false);
  assert.equal(shouldChargeBookingPayment("failed", true), true);
  assert.equal(shouldChargeBookingPayment("succeeded", true), false);
  assert.equal(shouldChargeBookingPayment("processing", true), false);
});

test("satisfactory returns refund deposits only", () => {
  assert.equal(automaticRefundKindForReturn("deposit", "good"), "deposit");
  assert.equal(automaticRefundKindForReturn("deposit", "fair"), null);
  assert.equal(automaticRefundKindForReturn("hire_fee", "good"), null);
});

test("stale payment operations require reconciliation instead of a fresh Stripe key", () => {
  const now = Date.parse("2026-10-24T00:00:00.000Z");
  assert.equal(isPaymentAttemptStale("2026-10-23T23:00:00.000Z", now), false);
  assert.equal(isPaymentAttemptStale("2026-10-23T00:59:59.000Z", now), true);
  assert.equal(isPaymentAttemptStale("invalid", now), true);
});
