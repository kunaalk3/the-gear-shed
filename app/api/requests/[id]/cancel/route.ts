import { NextResponse } from "next/server";
import { getCurrentUser, requireOrg } from "@/lib/auth";
import {
  cancelRequest,
  getBookingFulfillmentStatusForRequest,
  getItemById,
  getRequestById,
} from "@/lib/data/queries";
import { isCancellationBlockedByFulfillment } from "@/lib/fulfillment";
import { notifyAdmins, notifyUser } from "@/lib/notify";
import type { EquipmentItem } from "@/lib/types";
import { refundBookingPayments } from "@/lib/booking-payment-workflow";
import { buildCancellationResponse } from "@/lib/cancellation-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  let item: EquipmentItem | null = null;
  if (user.role === "org") {
    const auth = await requireOrg();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    item = await getItemById(existing.itemId, { includeRetired: true });
    if (!item || item.ownerId !== user.id) {
      return NextResponse.json({ error: "You can only cancel requests for your own items." }, { status: 403 });
    }
  } else if (user.role === "requester") {
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "You can only cancel your own requests." }, { status: 403 });
    }
    item = await getItemById(existing.itemId, { includeRetired: true });
  } else if (user.role === "admin") {
    item = await getItemById(existing.itemId, { includeRetired: true });
  } else {
    return NextResponse.json({ error: "You are not allowed to cancel this request." }, { status: 403 });
  }

  if (existing.status !== "pending" && existing.status !== "approved") {
    return NextResponse.json({ error: "Only pending or approved requests can be cancelled." }, { status: 409 });
  }

  const fulfillmentStatus = await getBookingFulfillmentStatusForRequest(id);
  if (isCancellationBlockedByFulfillment(fulfillmentStatus)) {
    return NextResponse.json(
      { error: "A request cannot be cancelled after equipment has been collected or a donation has been completed." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid cancellation reason is required." }, { status: 400 });
  }
  const reasonValue: unknown = body.reason;
  if (reasonValue !== undefined && typeof reasonValue !== "string") {
    return NextResponse.json({ error: "Cancellation reason must be text." }, { status: 400 });
  }
  const reasonText = typeof reasonValue === "string" ? reasonValue : "";
  if (reasonText.length > 1000) {
    return NextResponse.json({ error: "Cancellation reason must be 1,000 characters or fewer." }, { status: 400 });
  }
  const reason = reasonText.trim();

  const updated = await cancelRequest(id, existing.status, reason, user.id);
  if (!updated) {
    return NextResponse.json(
      { error: "This request has changed or its booking has been fulfilled, so it cannot be cancelled." },
      { status: 409 }
    );
  }

  const refundResult = await refundBookingPayments(id, "cancellation");

  try {
    if (user.role === "requester") {
      if (item?.ownerId) {
        await notifyUser(item.ownerId, "request_cancelled", `A request for ${item.name} was cancelled`, "/org/requests");
      } else {
        await notifyAdmins("request_cancelled", `A request for ${item?.name ?? "an item"} was cancelled`, "/admin/requests");
      }
    } else {
      await notifyUser(
        existing.userId,
        "request_cancelled",
        `Your request for ${item?.name ?? "an item"} was cancelled`,
        "/my-requests"
      );
    }
  } catch (error) {
    console.error("Request was cancelled, but notification delivery failed.", { requestId: id, error });
  }

  return NextResponse.json(buildCancellationResponse(updated, refundResult.unresolved));
}
