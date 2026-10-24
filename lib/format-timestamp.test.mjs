import assert from "node:assert/strict";
import test from "node:test";
import { formatTimestamp } from "./format-timestamp.ts";

test("timestamp formatting omits missing or invalid values", () => {
  assert.equal(formatTimestamp(null), null);
  assert.equal(formatTimestamp(""), null);
  assert.equal(formatTimestamp("not a timestamp"), null);
});

test("timestamp formatting returns a readable value for a valid timestamp", () => {
  assert.ok(formatTimestamp("2026-10-22T10:00:00.000Z"));
});
