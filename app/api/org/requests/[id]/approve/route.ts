import { NextResponse } from "next/server";
import { approveRequest, getItemById, getRequestById } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { chargeApprovedBooking } from "@/lib/booking-payment-workflow";
import {
  omitBookingPaymentProviderIdentifiers,
  omitPaymentProviderIdentifiers,
} from "@/lib/organization-request";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const item = await getItemById(existing.itemId, { includeRetired: true });
  if (!item || item.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "You can only act on requests for your own items." }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 });
  }

  const result = await approveRequest(id, auth.user.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason === "unavailable"
          ? "The item no longer has enough availability for those dates."
          : "Only pending requests can be approved.",
      },
      { status: 409 }
    );
  }
  const paymentResult = await chargeApprovedBooking(id);
  await notifyUser(existing.userId, "request_approved", `Your request for ${item.name} was approved`, "/my-requests");

  return NextResponse.json({
    request: omitPaymentProviderIdentifiers(result.request),
    payments: paymentResult.payments.map(omitBookingPaymentProviderIdentifiers),
    awaitingPaymentMethod: paymentResult.awaitingPaymentMethod,
    paymentUnresolved: paymentResult.unresolved,
  });
}
