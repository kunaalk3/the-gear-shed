import { NextResponse } from "next/server";
import { approveRequest, getItemById, getRequestById } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { chargeApprovedBooking } from "@/lib/booking-payment-workflow";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
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
  const item = await getItemById(existing.itemId, { includeRetired: true });
  const paymentResult = await chargeApprovedBooking(id);
  await notifyUser(
    existing.userId,
    "request_approved",
    `Your request for ${item?.name ?? "an item"} was approved`,
    "/my-requests"
  );

  return NextResponse.json({
    request: result.request,
    payments: paymentResult.payments,
    awaitingPaymentMethod: paymentResult.awaitingPaymentMethod,
    paymentUnresolved: paymentResult.unresolved,
  });
}
