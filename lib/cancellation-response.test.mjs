import assert from "node:assert/strict";
import test from "node:test";
import { buildCancellationResponse } from "./cancellation-response.ts";

test("cancellation response keeps status and refund state without exposing payment records", () => {
  const response = buildCancellationResponse({
    id: "request-1",
    status: "cancelled",
    stripeCustomerId: "cus_synthetic",
    stripePaymentMethodId: "pm_synthetic",
    bookingPayments: [{
      id: "payment-1",
      stripePaymentIntentId: "pi_synthetic",
      stripeRefundId: "re_synthetic",
      attempts: [{
        id: "attempt-1",
        idempotencyKey: "synthetic-idempotency-key",
        stripeObjectId: "re_attempt_synthetic",
      }],
    }],
  }, true);

  assert.deepEqual(response, {
    request: { id: "request-1", status: "cancelled" },
    refundsPending: true,
  });
  assert.equal(JSON.stringify(response).includes("stripe"), false);
  assert.equal(JSON.stringify(response).includes("payment-1"), false);
  assert.equal(JSON.stringify(response).includes("attempt-1"), false);
});
