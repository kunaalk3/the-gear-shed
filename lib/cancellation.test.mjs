import assert from "node:assert/strict";
import test from "node:test";
import { isCancellationBlockedByFulfillment } from "./fulfillment.ts";

test("a booking can be cancelled before collection", () => {
  assert.equal(isCancellationBlockedByFulfillment("not_started"), false);
  assert.equal(isCancellationBlockedByFulfillment(null), false);
});

test("a collected booking cannot be cancelled", () => {
  assert.equal(isCancellationBlockedByFulfillment("collected"), true);
  assert.equal(isCancellationBlockedByFulfillment("returned"), true);
});

test("a completed permanent donation cannot be cancelled", () => {
  assert.equal(isCancellationBlockedByFulfillment("donation_completed"), true);
});
