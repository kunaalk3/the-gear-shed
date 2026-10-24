import assert from "node:assert/strict";
import test from "node:test";
import {
  omitBookingPaymentProviderIdentifiers,
  omitOrganizationRequestPaymentData,
  omitPaymentProviderIdentifiers,
} from "./organization-request.ts";

test("organization request response preserves UI fields but omits Stripe identifiers", () => {
  const safeRequest = omitPaymentProviderIdentifiers({
    id: "request-1",
    status: "approved",
    itemName: "Community tables",
    requesterName: "Taylor",
    stripeCustomerId: "cus_synthetic",
    stripePaymentMethodId: "pm_synthetic",
  });

  test("organization request data omits all payment data needed only by other views", () => {
    const request = omitOrganizationRequestPaymentData({
      id: "request-1",
      status: "pending",
      stripeCustomerId: "cus_synthetic",
      stripePaymentMethodId: "pm_synthetic",
      bookingPayments: [{
        id: "payment-1",
        stripePaymentIntentId: "pi_synthetic",
        stripeRefundId: "re_synthetic",
      }],
    });

    assert.deepEqual(request, { id: "request-1", status: "pending" });
  });
  const bookingPayments = [{
    id: "payment-1",
    kind: "deposit",
    status: "succeeded",
    amountCents: 5000,
    stripePaymentIntentId: "pi_synthetic",
    stripeRefundId: "re_synthetic",
  }];

  assert.deepEqual(safeRequest, {
    id: "request-1",
    status: "approved",
    itemName: "Community tables",
    requesterName: "Taylor",
  });
  assert.deepEqual(
    bookingPayments.map(omitBookingPaymentProviderIdentifiers),
    [{
      id: "payment-1",
      kind: "deposit",
      status: "succeeded",
      amountCents: 5000,
    }]
  );
  assert.deepEqual(
    omitPaymentProviderIdentifiers({
      stripeCustomerId: "cus_synthetic",
      stripePaymentMethodId: "pm_synthetic",
    }),
    {}
  );
  assert.deepEqual(
    omitBookingPaymentProviderIdentifiers({
      id: "payment-1",
      stripePaymentIntentId: "pi_synthetic",
      stripeRefundId: "re_synthetic",
    }),
    { id: "payment-1" }
  );
});
