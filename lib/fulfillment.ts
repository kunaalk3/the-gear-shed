import type { EquipmentCondition, TransactionType } from "@/lib/types";

export type BookingFulfillmentStatus =
  | "not_started"
  | "collected"
  | "returned"
  | "donation_completed"
  | "legacy_unknown";

export type BookingFulfillmentEventType =
  | "collection_confirmed"
  | "return_inspected"
  | "donation_handover_confirmed";

export interface BookingFulfillmentHistoryEvent {
  id: string;
  eventType: BookingFulfillmentEventType;
  actorName: string | null;
  occurredAt: string;
  quantity: number;
  condition: EquipmentCondition;
  notes: string;
  evidenceRefs: string[];
}

export function isCancellationBlockedByFulfillment(
  status: BookingFulfillmentStatus | null
): boolean {
  return (
    status === "collected" ||
    status === "returned" ||
    status === "donation_completed"
  );
}

export interface FulfillmentTransitionInput {
  bookingStatus: "pending" | "approved" | "cancelled";
  transactionType: TransactionType;
  fulfillmentStatus: BookingFulfillmentStatus;
  eventType: BookingFulfillmentEventType;
}

export interface FulfillmentTransition {
  fulfillmentStatus: BookingFulfillmentStatus;
  inventoryDelta: number;
}

export function decideFulfillmentTransition(
  input: FulfillmentTransitionInput,
  bookingQuantity: number
): FulfillmentTransition | null {
  if (input.bookingStatus !== "approved" || !Number.isInteger(bookingQuantity) || bookingQuantity < 1) {
    return null;
  }

  if (
    input.eventType === "collection_confirmed" &&
    (input.transactionType === "paid_hire" ||
      input.transactionType === "temporary_free_loan") &&
    input.fulfillmentStatus === "not_started"
  ) {
    return { fulfillmentStatus: "collected", inventoryDelta: 0 };
  }

  if (
    input.eventType === "return_inspected" &&
    (input.transactionType === "paid_hire" ||
      input.transactionType === "temporary_free_loan") &&
    input.fulfillmentStatus === "collected"
  ) {
    return { fulfillmentStatus: "returned", inventoryDelta: 0 };
  }

  if (
    input.eventType === "donation_handover_confirmed" &&
    input.transactionType === "permanent_donation" &&
    input.fulfillmentStatus === "not_started"
  ) {
    return {
      fulfillmentStatus: "donation_completed",
      inventoryDelta: -bookingQuantity,
    };
  }

  return null;
}
