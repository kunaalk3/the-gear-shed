import assert from "node:assert/strict";
import test from "node:test";
import { canReduceInventoryTo } from "./availability.ts";
import { decideFulfillmentTransition } from "./fulfillment.ts";

function transition(overrides = {}, quantity = 3) {
  return decideFulfillmentTransition(
    {
      bookingStatus: "approved",
      transactionType: "paid_hire",
      fulfillmentStatus: "not_started",
      eventType: "collection_confirmed",
      ...overrides,
    },
    quantity
  );
}

test("approved hire and free-loan bookings can be collected once", () => {
  for (const transactionType of ["paid_hire", "temporary_free_loan"]) {
    assert.deepEqual(
      transition({ transactionType }),
      { fulfillmentStatus: "collected", inventoryDelta: 0 }
    );
  }
});

test("collected hire and free-loan bookings can be inspected on return", () => {
  for (const transactionType of ["paid_hire", "temporary_free_loan"]) {
    assert.deepEqual(
      transition({
        transactionType,
        fulfillmentStatus: "collected",
        eventType: "return_inspected",
      }),
      { fulfillmentStatus: "returned", inventoryDelta: 0 }
    );
  }
});

test("approved permanent donations complete and decrement the full booking quantity", () => {
  assert.deepEqual(
    transition(
      {
        transactionType: "permanent_donation",
        eventType: "donation_handover_confirmed",
      },
      4
    ),
    { fulfillmentStatus: "donation_completed", inventoryDelta: -4 }
  );
});

test("pending, cancelled, duplicate, and transaction-mismatched transitions are rejected", () => {
  assert.equal(transition({ bookingStatus: "pending" }), null);
  assert.equal(transition({ bookingStatus: "cancelled" }), null);
  assert.equal(transition({ fulfillmentStatus: "collected" }), null);
  assert.equal(
    transition({
      transactionType: "permanent_donation",
      eventType: "collection_confirmed",
    }),
    null
  );
  assert.equal(
    transition({
      transactionType: "paid_hire",
      eventType: "donation_handover_confirmed",
    }),
    null
  );
});

test("only a complete positive booking quantity is eligible for transition", () => {
  assert.equal(transition({}, 0), null);
  assert.equal(transition({}, 1.5), null);
  assert.equal(transition({}, -1), null);
});

test("a completed transition cannot be replayed from its new state", () => {
  const first = transition();
  assert.ok(first);
  assert.equal(transition({ fulfillmentStatus: first.fulfillmentStatus }), null);
});

test("donation inventory decrement preserves other future commitments", () => {
  const laterBooking = {
    id: "future-booking",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    quantity: 2,
    status: "approved",
    fulfillmentStatus: "not_started",
    fulfillmentEvents: [],
  };

  assert.equal(canReduceInventoryTo([laterBooking], 2), true);
  assert.equal(canReduceInventoryTo([laterBooking], 1), false);
  assert.equal(canReduceInventoryTo([], 0), true);
});
