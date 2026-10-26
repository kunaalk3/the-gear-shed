import assert from "node:assert/strict";
import test from "node:test";
import { waitForPaymentSetupConfirmation } from "./payment-setup.ts";

test("payment setup is confirmed only after the server reports a saved card", async () => {
  const statuses = ["none", "card_saved"];
  const waits = [];

  const result = await waitForPaymentSetupConfirmation(
    async () => statuses.shift(),
    async (milliseconds) => waits.push(milliseconds),
    3,
    25
  );

  assert.equal(result, "saved");
  assert.deepEqual(waits, [25]);
});

test("an unsuccessful checkout status is not reported as saved", async () => {
  const result = await waitForPaymentSetupConfirmation(
    async () => "failed",
    async () => assert.fail("failed setup should not be retried")
  );

  assert.equal(result, "failed");
});

test("missing requests and unconfirmed webhook persistence are distinct outcomes", async () => {
  const wait = async () => {};

  assert.equal(
    await waitForPaymentSetupConfirmation(async () => "not_found", wait),
    "not_found"
  );
  assert.equal(
    await waitForPaymentSetupConfirmation(async () => "none", wait, 3, 0),
    "not_confirmed"
  );
});

test("an unavailable request endpoint stops payment confirmation polling without throwing", async () => {
  assert.equal(
    await waitForPaymentSetupConfirmation(
      async () => "unavailable",
      async () => assert.fail("unavailable endpoint should stop polling")
    ),
    "not_confirmed"
  );
});
