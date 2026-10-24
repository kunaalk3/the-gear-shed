import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin, requireOrg } from "@/lib/auth";
import {
  getBookingFulfillmentDetails,
  hasUnsettledBookingPayments,
  recordBookingFulfillment,
} from "@/lib/data/queries";
import { decideFulfillmentTransition } from "@/lib/fulfillment";
import { handleRecordedReturn } from "@/lib/booking-payment-workflow";
import {
  isEquipmentCondition,
  type EquipmentCondition,
} from "@/lib/types";
import type { BookingFulfillmentEventType } from "@/lib/fulfillment";

const EVENT_TYPES: readonly BookingFulfillmentEventType[] = [
  "collection_confirmed",
  "return_inspected",
  "donation_handover_confirmed",
];

const MAX_NOTES_LENGTH = 2_000;
const MAX_EVIDENCE_REFS = 5;
const MAX_EVIDENCE_REF_LENGTH = 2_048;

function isHttpsEvidenceRef(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_EVIDENCE_REF_LENGTH
  ) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to continue." }, { status: 401 });
  }

  let actorRole: "admin" | "org";
  if (user.role === "admin") {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    actorRole = "admin";
  } else if (user.role === "org") {
    const auth = await requireOrg();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    actorRole = "org";
  } else {
    return NextResponse.json({ error: "Provider access is required." }, { status: 403 });
  }

  const { id: bookingId } = await params;
  const details = await getBookingFulfillmentDetails(bookingId);
  if (!details) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (actorRole === "org" && details.ownerId !== user.id) {
    return NextResponse.json(
      { error: "You can only update fulfilment for your own items." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid fulfilment record is required." }, { status: 400 });
  }

  const eventType: unknown = body.eventType;
  const condition: unknown = body.condition;
  const notes: unknown = body.notes ?? "";
  const evidenceRefs: unknown = body.evidenceRefs ?? [];

  if (!EVENT_TYPES.includes(eventType as BookingFulfillmentEventType)) {
    return NextResponse.json({ error: "Invalid fulfilment event type." }, { status: 400 });
  }
  if (!isEquipmentCondition(condition)) {
    return NextResponse.json({ error: "A valid equipment condition is required." }, { status: 400 });
  }
  if (typeof notes !== "string" || notes.length > MAX_NOTES_LENGTH) {
    return NextResponse.json(
      { error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(evidenceRefs) ||
    evidenceRefs.length > MAX_EVIDENCE_REFS ||
    !evidenceRefs.every(isHttpsEvidenceRef)
  ) {
    return NextResponse.json(
      { error: `Evidence must contain up to ${MAX_EVIDENCE_REFS} HTTPS links.` },
      { status: 400 }
    );
  }

  const transition = decideFulfillmentTransition(
    {
      bookingStatus: details.bookingStatus,
      transactionType: details.transactionType,
      fulfillmentStatus: details.fulfillmentStatus,
      eventType: eventType as BookingFulfillmentEventType,
    },
    details.quantity
  );
  if (!transition) {
    return NextResponse.json(
      { error: "This booking is not eligible for that fulfilment transition." },
      { status: 409 }
    );
  }
  if (
    eventType === "collection_confirmed" &&
    await hasUnsettledBookingPayments(details.requestId)
  ) {
    return NextResponse.json(
      { error: "All required booking payments must succeed before collection can be confirmed." },
      { status: 409 }
    );
  }

  const recorded = await recordBookingFulfillment({
    bookingId,
    actorUserId: user.id,
    actorRole,
    eventType: eventType as BookingFulfillmentEventType,
    condition: condition as EquipmentCondition,
    notes: notes.trim(),
    evidenceRefs,
    occurredAt: new Date().toISOString(),
  });
  if (!recorded) {
    return NextResponse.json(
      { error: "The booking changed or its inventory is insufficient. Refresh and try again." },
      { status: 409 }
    );
  }

  const paymentResult = eventType === "return_inspected"
    ? await handleRecordedReturn(details.requestId, condition)
    : null;

  return NextResponse.json({
    fulfillmentStatus: transition.fulfillmentStatus,
    inventoryDelta: transition.inventoryDelta,
    payments: paymentResult?.payments,
    refundPending: paymentResult?.unresolved ?? false,
  });
}
