import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilityLevel,
  availableByDay,
  calendarDateOverride,
  canReduceInventoryTo,
  isIsoDate,
  maxCommittedQuantity,
  minAvailableInRange,
} from "./availability.ts";

function booking(overrides = {}) {
  return {
    id: "booking-1",
    startDate: "2026-08-10",
    endDate: "2026-08-12",
    quantity: 1,
    status: "approved",
    fulfillmentStatus: "not_started",
    fulfillmentEvents: [],
    ...overrides,
  };
}

test("only approved overlapping bookings reduce daily availability across inclusive dates", () => {
  const result = availableByDay(
    [
      booking({ quantity: 2 }),
      booking({
        startDate: "2026-08-11",
        endDate: "2026-08-13",
        quantity: 1,
        status: "approved",
      }),
    ],
    4,
    "2026-08-10",
    "2026-08-13"
  );

  assert.deepEqual(result, {
    "2026-08-10": 2,
    "2026-08-11": 1,
    "2026-08-12": 1,
    "2026-08-13": 3,
  });
});

test("pending requests do not reduce confirmed availability", () => {
  assert.deepEqual(
    availableByDay(
      [booking({ quantity: 3, status: "pending" })],
      3,
      "2026-08-10",
      "2026-08-12"
    ),
    {
      "2026-08-10": 3,
      "2026-08-11": 3,
      "2026-08-12": 3,
    }
  );
});

test("range availability reports when a requested quantity is unavailable", () => {
  const reservations = [booking({ quantity: 2 })];
  const minimumAvailable = minAvailableInRange(
    reservations,
    3,
    "2026-08-10",
    "2026-08-12"
  );

  assert.equal(minimumAvailable, 1);
  assert.equal(minimumAvailable < 2, true);
});

test("collected equipment remains unavailable after the planned end date", () => {
  const result = availableByDay(
    [
      booking({
        endDate: "2026-08-12",
        fulfillmentStatus: "collected",
        fulfillmentEvents: [{
          eventType: "collection_confirmed",
          occurredAt: "2026-08-10T09:00:00.000Z",
          quantity: 1,
        }],
      }),
    ],
    1,
    "2026-08-12",
    "2026-08-14"
  );

  assert.deepEqual(result, {
    "2026-08-12": 0,
    "2026-08-13": 0,
    "2026-08-14": 0,
  });
});

test("collection moves units from reservations to checkout without double-counting", () => {
  const result = availableByDay(
    [
      booking({
        quantity: 1,
        fulfillmentStatus: "collected",
        fulfillmentEvents: [{
          eventType: "collection_confirmed",
          occurredAt: "2026-08-11T09:00:00.000Z",
          quantity: 1,
        }],
      }),
      booking({
        startDate: "2026-08-11",
        endDate: "2026-08-11",
        quantity: 1,
      }),
    ],
    3,
    "2026-08-11",
    "2026-08-11"
  );

  assert.deepEqual(result, { "2026-08-11": 1 });
});

test("an early inspected return releases stock on the following date", () => {
  const result = availableByDay(
    [
      booking({
        endDate: "2026-08-20",
        fulfillmentStatus: "returned",
        fulfillmentEvents: [
          {
            eventType: "collection_confirmed",
            occurredAt: "2026-08-10T09:00:00.000Z",
            quantity: 1,
          },
          {
            eventType: "return_inspected",
            occurredAt: "2026-08-11T15:00:00.000Z",
            quantity: 1,
          },
        ],
      }),
    ],
    1,
    "2026-08-11",
    "2026-08-13"
  );

  assert.deepEqual(result, {
    "2026-08-11": 0,
    "2026-08-12": 1,
    "2026-08-13": 1,
  });
});

test("cancelled bookings do not reduce availability", () => {
  assert.deepEqual(
    availableByDay(
      [booking({ status: "cancelled" })],
      1,
      "2026-08-10",
      "2026-08-12"
    ),
    {
      "2026-08-10": 1,
      "2026-08-11": 1,
      "2026-08-12": 1,
    }
  );
});

test("cancelling a collected booking does not release checked-out stock", () => {
  assert.deepEqual(
    availableByDay(
      [
        booking({
          status: "cancelled",
          endDate: "2026-08-10",
          fulfillmentStatus: "collected",
          fulfillmentEvents: [{
            eventType: "collection_confirmed",
            occurredAt: "2026-08-10T09:00:00.000Z",
            quantity: 1,
          }],
        }),
      ],
      1,
      "2026-08-10",
      "2026-08-12"
    ),
    {
      "2026-08-10": 0,
      "2026-08-11": 0,
      "2026-08-12": 0,
    }
  );
});

test("cancelled legacy bookings without collection evidence do not reduce availability", () => {
  assert.deepEqual(
    availableByDay(
      [
        booking({
          status: "cancelled",
          startDate: "2026-08-07",
          endDate: "2026-08-10",
          fulfillmentStatus: "legacy_unknown",
        }),
      ],
      1,
      "2026-08-11",
      "2026-08-13"
    ),
    {
      "2026-08-11": 1,
      "2026-08-12": 1,
      "2026-08-13": 1,
    }
  );
});

test("cancelled booking with collection evidence remains unavailable until return", () => {
  assert.deepEqual(
    availableByDay(
      [
        booking({
          status: "cancelled",
          endDate: "2026-08-10",
          fulfillmentStatus: "collected",
          fulfillmentEvents: [{
            eventType: "collection_confirmed",
            occurredAt: "2026-08-10T09:00:00.000Z",
            quantity: 1,
          }],
        }),
      ],
      1,
      "2026-08-11",
      "2026-08-13"
    ),
    {
      "2026-08-11": 0,
      "2026-08-12": 0,
      "2026-08-13": 0,
    }
  );
});

test("a cancelled collected booking releases stock after its return is recorded", () => {
  assert.deepEqual(
    availableByDay(
      [
        booking({
          status: "cancelled",
          endDate: "2026-08-10",
          fulfillmentStatus: "returned",
          fulfillmentEvents: [
            {
              eventType: "collection_confirmed",
              occurredAt: "2026-08-10T09:00:00.000Z",
              quantity: 1,
            },
            {
              eventType: "return_inspected",
              occurredAt: "2026-08-11T15:00:00.000Z",
              quantity: 1,
            },
          ],
        }),
      ],
      1,
      "2026-08-11",
      "2026-08-13"
    ),
    {
      "2026-08-11": 0,
      "2026-08-12": 1,
      "2026-08-13": 1,
    }
  );
});

test("completed donation bookings are not counted against already-decremented inventory", () => {
  assert.deepEqual(
    availableByDay(
      [booking({ fulfillmentStatus: "donation_completed" })],
      2,
      "2026-08-10",
      "2026-08-12"
    ),
    {
      "2026-08-10": 2,
      "2026-08-11": 2,
      "2026-08-12": 2,
    }
  );
});

test("legacy fulfillment remains conservatively unavailable after the planned end", () => {
  assert.deepEqual(
    availableByDay(
      [booking({ endDate: "2026-08-10", fulfillmentStatus: "legacy_unknown" })],
      1,
      "2026-08-10",
      "2026-08-12"
    ),
    {
      "2026-08-10": 0,
      "2026-08-11": 0,
      "2026-08-12": 0,
    }
  );
});

test("calendar availability levels use the same daily values returned by the API", () => {
  const apiResponseAvailability = availableByDay(
    [booking({ quantity: 2 })],
    3,
    "2026-08-10",
    "2026-08-12"
  );

  assert.equal(
    availabilityLevel(apiResponseAvailability["2026-08-10"], 3),
    "limited"
  );
  assert.equal(
    availabilityLevel(apiResponseAvailability["2026-08-11"], 3),
    "limited"
  );
  assert.equal(
    availabilityLevel(apiResponseAvailability["2026-08-12"], 3),
    "limited"
  );
});

test("ISO date validation rejects malformed and impossible dates", () => {
  assert.equal(isIsoDate("2026-08-10"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026/08/10"), false);
  assert.equal(isIsoDate(null), false);
});

test("calendar marks both endpoints and every date in an October 22–24 blackout unavailable", () => {
  const blackouts = [{ startDate: "2026-10-22", endDate: "2026-10-24" }];

  assert.equal(calendarDateOverride("2026-10-22", "2026-10-23", blackouts), "blackout");
  assert.equal(calendarDateOverride("2026-10-23", "2026-10-23", blackouts), "blackout");
  assert.equal(calendarDateOverride("2026-10-24", "2026-10-23", blackouts), "blackout");
  assert.equal(calendarDateOverride("2026-10-21", "2026-10-23", blackouts), "past");
  assert.equal(calendarDateOverride("2026-10-25", "2026-10-23", blackouts), null);
});

test("provider blackout dates have zero effective availability on inclusive endpoints", () => {
  assert.deepEqual(
    availableByDay(
      [],
      3,
      "2026-10-21",
      "2026-10-25",
      [{ startDate: "2026-10-22", endDate: "2026-10-24" }]
    ),
    {
      "2026-10-21": 3,
      "2026-10-22": 0,
      "2026-10-23": 0,
      "2026-10-24": 0,
      "2026-10-25": 3,
    }
  );
});

test("availability levels map quantity to available, limited, or fully booked", () => {
  assert.equal(availabilityLevel(3, 3), "available");
  assert.equal(availabilityLevel(2, 3), "limited");
  assert.equal(availabilityLevel(0, 3), "full");
  assert.equal(
    calendarDateOverride("2026-10-23", "2026-10-23", [
      { startDate: "2026-10-22", endDate: "2026-10-24" },
    ]),
    "blackout"
  );
});

test("Tech bench October 25–31 ignores a cancelled legacy booking and counts approved overlap", () => {
  const cancelledLegacyBooking = booking({
    id: "tech-bench-cancelled",
    startDate: "2026-10-20",
    endDate: "2026-10-24",
    quantity: 1,
    status: "cancelled",
    fulfillmentStatus: "legacy_unknown",
  });
  const approvedBooking = booking({
    id: "tech-bench-approved",
    startDate: "2026-10-25",
    endDate: "2026-10-29",
    quantity: 15,
    status: "approved",
  });

  assert.deepEqual(
    availableByDay(
      [cancelledLegacyBooking, approvedBooking],
      30,
      "2026-10-25",
      "2026-10-31"
    ),
    {
      "2026-10-25": 15,
      "2026-10-26": 15,
      "2026-10-27": 15,
      "2026-10-28": 15,
      "2026-10-29": 15,
      "2026-10-30": 30,
      "2026-10-31": 30,
    }
  );
});

test("inventory may be safely reduced to the maximum overlapping commitment", () => {
  const bookings = [
    booking({ quantity: 2 }),
    booking({
      startDate: "2026-08-11",
      endDate: "2026-08-13",
      quantity: 1,
      status: "approved",
    }),
    booking({
      startDate: "2026-08-14",
      endDate: "2026-08-16",
      quantity: 2,
    }),
  ];

  assert.equal(maxCommittedQuantity(bookings), 3);
  assert.equal(canReduceInventoryTo(bookings, 3), true);
  assert.equal(canReduceInventoryTo(bookings, 4), true);
});

test("inventory cannot be reduced below active reservations", () => {
  const bookings = [
    booking({ quantity: 2 }),
    booking({
      startDate: "2026-08-11",
      endDate: "2026-08-13",
      quantity: 2,
      status: "approved",
    }),
  ];

  assert.equal(maxCommittedQuantity(bookings), 4);
  assert.equal(canReduceInventoryTo(bookings, 3), false);
});

test("inventory cannot be reduced below checked-out equipment", () => {
  const bookings = [
    booking({
      status: "cancelled",
      endDate: "2026-08-10",
      quantity: 2,
      fulfillmentStatus: "collected",
      fulfillmentEvents: [{
        eventType: "collection_confirmed",
        occurredAt: "2026-08-10T09:00:00.000Z",
        quantity: 2,
      }],
    }),
    booking({
      startDate: "2026-08-11",
      endDate: "2026-08-12",
      quantity: 1,
    }),
  ];

  assert.equal(maxCommittedQuantity(bookings), 3);
  assert.equal(canReduceInventoryTo(bookings, 2), false);
});

test("a newly committed reservation changes the safe inventory-reduction result", () => {
  const initialBookings = [booking({ quantity: 1 })];
  const latestBookings = [
    ...initialBookings,
    booking({
      startDate: "2026-08-11",
      endDate: "2026-08-11",
      quantity: 1,
      status: "approved",
    }),
  ];

  assert.equal(canReduceInventoryTo(initialBookings, 1), true);
  assert.equal(canReduceInventoryTo(latestBookings, 1), false);
});
