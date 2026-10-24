export type BookingPaymentKind = "hire_fee" | "deposit";
export type BookingPaymentStatus =
  | "awaiting_payment_method"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "refund_failed"
  | "manual_review";
export type BookingPaymentOperation = "charge" | "refund";

export interface BookingPayment {
  id: string;
  requestId: string;
  kind: BookingPaymentKind;
  amountCents: number;
  currency: "aud";
  status: BookingPaymentStatus;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  chargedAt: string | null;
  refundedAt: string | null;
  failureMessage: string | null;
}

export function calculateHireFeeCents(
  dailyRateDollars: number,
  startDate: string,
  endDate: string,
  quantity: number
): number {
  if (!Number.isSafeInteger(dailyRateDollars) || dailyRateDollars < 0) {
    throw new RangeError("Daily rate must be a non-negative whole-dollar amount.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new RangeError("Quantity must be a positive whole number.");
  }

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const dayCount = Math.floor((end - start) / 86_400_000) + 1;
  if (dayCount < 1) throw new RangeError("End date cannot be before start date.");

  const amountCents = dailyRateDollars * dayCount * quantity * 100;
  if (!Number.isSafeInteger(amountCents)) {
    throw new RangeError("Hire fee exceeds the supported amount.");
  }
  return amountCents;
}

function parseIsoDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Booking dates must use YYYY-MM-DD format.");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new RangeError("Booking date is invalid.");
  }
  return timestamp;
}

export function qualifiesForAutomaticDepositRefund(condition: string): boolean {
  return condition === "excellent" || condition === "good";
}

export function shouldCollectDeposit(
  transactionType: "paid_hire" | "temporary_free_loan" | "permanent_donation"
): boolean {
  return transactionType !== "permanent_donation";
}

export function shouldRefundForCancellation(status: BookingPaymentStatus): boolean {
  return status === "succeeded" || status === "refund_failed";
}

export function shouldChargeBookingPayment(
  status: BookingPaymentStatus,
  retryFailed: boolean
): boolean {
  return status === "pending" || (retryFailed && status === "failed");
}

export function paymentStatusForStripeResult(
  operation: BookingPaymentOperation,
  stripeStatus: string
): BookingPaymentStatus {
  if (operation === "charge") {
    if (stripeStatus === "succeeded") return "succeeded";
    if (
      stripeStatus === "requires_payment_method" ||
      stripeStatus === "requires_action" ||
      stripeStatus === "canceled"
    ) {
      return "failed";
    }
    return "processing";
  }

  if (stripeStatus === "succeeded") return "refunded";
  if (stripeStatus === "failed" || stripeStatus === "canceled") return "refund_failed";
  return "refund_pending";
}

export function automaticRefundKindForReturn(
  paymentKind: BookingPaymentKind,
  condition: string
): BookingPaymentKind | null {
  return paymentKind === "deposit" && qualifiesForAutomaticDepositRefund(condition)
    ? "deposit"
    : null;
}

export function isPaymentAttemptStale(createdAt: string, now = Date.now()): boolean {
  const createdAtMs = Date.parse(createdAt);
  return !Number.isFinite(createdAtMs) || now - createdAtMs >= 23 * 60 * 60 * 1000;
}
