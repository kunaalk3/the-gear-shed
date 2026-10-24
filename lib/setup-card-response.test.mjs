import assert from "node:assert/strict";
import test from "node:test";
import {
  createSetupCardErrorResponse,
  readSetupCardResponse,
} from "./setup-card-response.ts";

function response(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("setup-card parser accepts a checkout URL", async () => {
  assert.deepEqual(
    await readSetupCardResponse(response(JSON.stringify({ url: "https://checkout.example/session" }))),
    { ok: true, url: "https://checkout.example/session" }
  );
});

test("setup-card parser returns API error messages without throwing", async () => {
  assert.deepEqual(
    await readSetupCardResponse(response(JSON.stringify({ error: "Request is not approved." }), 409)),
    { ok: false, error: "Request is not approved." }
  );
});

test("setup-card parser handles empty and malformed responses without throwing", async () => {
  for (const body of ["", "<html>failure</html>"]) {
    assert.deepEqual(
      await readSetupCardResponse(response(body)),
      {
        ok: false,
        error: "The server returned an invalid payment setup response. Please try again.",
      }
    );
  }
});

test("unexpected server failures produce a generic JSON error", async () => {
  const failure = createSetupCardErrorResponse();
  assert.equal(failure.status, 500);
  assert.deepEqual(
    await readSetupCardResponse(response(JSON.stringify(failure.body), failure.status)),
    { ok: false, error: "Could not start payment setup. Please try again." }
  );
});

test("missing Stripe configuration produces a safe service-unavailable response", async () => {
  const failure = createSetupCardErrorResponse(
    Object.assign(new Error("configuration unavailable"), {
      name: "StripeConfigurationError",
      issue: "missing",
    })
  );
  assert.equal(failure.status, 503);
  assert.deepEqual(
    await readSetupCardResponse(response(JSON.stringify(failure.body), failure.status)),
    {
      ok: false,
      error: "Payment setup is unavailable because the server is missing its Stripe test-mode configuration.",
    }
  );
});

test("live-mode Stripe configuration is rejected without exposing the key", async () => {
  const failure = createSetupCardErrorResponse(
    Object.assign(new Error("configuration unavailable"), {
      name: "StripeConfigurationError",
      issue: "test_mode_required",
    })
  );
  assert.equal(failure.status, 503);
  assert.deepEqual(failure.body, {
    error: "Payment setup is unavailable because the server requires a Stripe test-mode secret key.",
  });
});
