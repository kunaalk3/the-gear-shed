import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("organization request listing does not depend on the separately migrated payment tables", async () => {
  const source = await readFile(new URL("./data/queries.ts", import.meta.url), "utf8");
  const start = source.indexOf("export async function getRequestsForOwner(");
  const end = source.indexOf("\nexport async function getRequestsForUser(", start);

  assert.notEqual(start, -1, "owner request query should exist");
  assert.notEqual(end, -1, "owner request query should have a bounded definition");

  const ownerQuery = source.slice(start, end);
  assert.doesNotMatch(ownerQuery, /attachBookingPayments|getBookingPaymentsForRequest|booking_payments/);
  assert.match(ownerQuery, /where i\.owner_id = \$\{ownerId\}/);
});
