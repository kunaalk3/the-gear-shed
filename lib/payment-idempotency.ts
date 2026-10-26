export function depositChargeIdempotencyKey(attemptId: string): string {
  return `deposit-charge-${attemptId}`;
}

export function depositChargeNotificationId(attemptId: string): string {
  return `deposit-charge-notification-${attemptId}`;
}

export function stripeWebhookNotificationId(eventId: string): string {
  return `stripe-webhook-${eventId}`;
}

export function isSuccessfulPaymentIntent(status: string): boolean {
  return status === "succeeded";
}

export function isDefinitiveFailedPaymentIntent(status: string): boolean {
  return status === "requires_payment_method" ||
    status === "requires_action" ||
    status === "canceled";
}

export function isDepositChargeAttemptStale(
  createdAt: string,
  now = Date.now()
): boolean {
  const createdAtMs = Date.parse(createdAt);
  return !Number.isFinite(createdAtMs) || now - createdAtMs >= 23 * 60 * 60 * 1000;
}

export async function notifyAfterSuccessfulDepositCharge(
  deliver: () => Promise<void>,
  onFailure: (error: unknown) => void
): Promise<void> {
  try {
    await deliver();
  } catch (error) {
    onFailure(error);
  }
}
