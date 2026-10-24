export function omitPaymentProviderIdentifiers<
  T extends {
    stripeCustomerId: string | null;
    stripePaymentMethodId: string | null;
  },
>(request: T) {
  const {
    stripeCustomerId: _stripeCustomerId,
    stripePaymentMethodId: _stripePaymentMethodId,
    ...safeRequest
  } = request;
  void _stripeCustomerId;
  void _stripePaymentMethodId;
  return safeRequest;
}

export function omitBookingPaymentProviderIdentifiers<
  T extends {
    stripePaymentIntentId: string | null;
    stripeRefundId: string | null;
  },
>(payment: T) {
  const {
    stripePaymentIntentId: _stripePaymentIntentId,
    stripeRefundId: _stripeRefundId,
    ...safePayment
  } = payment;
  void _stripePaymentIntentId;
  void _stripeRefundId;
  return safePayment;
}

export function omitOrganizationRequestPaymentData<
  T extends {
    stripeCustomerId: string | null;
    stripePaymentMethodId: string | null;
    bookingPayments?: unknown;
  },
>(request: T) {
  const {
    stripeCustomerId: _stripeCustomerId,
    stripePaymentMethodId: _stripePaymentMethodId,
    bookingPayments: _bookingPayments,
    ...safeRequest
  } = request;
  void _stripeCustomerId;
  void _stripePaymentMethodId;
  void _bookingPayments;
  return safeRequest;
}
