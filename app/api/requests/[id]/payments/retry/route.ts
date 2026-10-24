import { NextResponse } from "next/server";
import { getRequestById } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";
import { chargeApprovedBooking } from "@/lib/booking-payment-workflow";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "You can only retry payment for your own requests." }, { status: 403 });
  }
  if (existing.status !== "approved") {
    return NextResponse.json({ error: "Payment can only be retried for an approved request." }, { status: 409 });
  }
  if (!existing.stripeCustomerId || !existing.stripePaymentMethodId) {
    return NextResponse.json({ error: "Save a payment method before retrying payment." }, { status: 409 });
  }

  const result = await chargeApprovedBooking(id, true);
  return NextResponse.json({
    payments: result.payments,
    paymentUnresolved: result.unresolved,
  });
}
