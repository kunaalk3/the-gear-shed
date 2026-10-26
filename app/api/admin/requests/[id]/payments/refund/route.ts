import { NextResponse } from "next/server";
import {
  getBookingFulfillmentStatusForRequest,
  getBookingPaymentsForRequest,
  getRequestById,
} from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { refundBookingPayments } from "@/lib/booking-payment-workflow";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || (body.paymentKind !== "deposit" && body.paymentKind !== "hire_fee")) {
    return NextResponse.json({ error: "A valid booking payment must be selected." }, { status: 400 });
  }
  const payment = (await getBookingPaymentsForRequest(id))
    .find((entry) => entry.kind === body.paymentKind);
  const fulfillmentStatus = await getBookingFulfillmentStatusForRequest(id);
  const isManualDepositDecision =
    payment?.kind === "deposit" &&
    payment.status === "manual_review" &&
    fulfillmentStatus === "returned";
  const isRefundRetry = payment?.status === "refund_failed" ||
    payment?.status === "refund_pending" ||
    (existing.status === "cancelled" && payment?.status === "succeeded");
  if (!payment || (!isManualDepositDecision && !isRefundRetry)) {
    return NextResponse.json({ error: "This payment is not awaiting an authorized refund decision or retry." }, { status: 409 });
  }

  const result = await refundBookingPayments(
    id,
    existing.status === "cancelled" ? "cancellation" : "satisfactory_return",
    payment.kind,
    isManualDepositDecision
  );
  return NextResponse.json({
    payments: result.payments,
    refundPending: result.unresolved,
  });
}
