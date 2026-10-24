import assert from "node:assert/strict";
import test from "node:test";
import {
  createMyRequestsErrorResponse,
  readMyRequestsResponse,
} from "./my-requests-response.ts";

function response(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("missing booking_payments relation returns an explicit migration-required response", () => {
  const result = createMyRequestsErrorResponse({
    name: "NeonDbError",
    code: "42P01",
    message: 'relation "booking_payments" does not exist',
  });

  assert.equal(result.status, 503);
  assert.match(result.body.error, /booking payment schema is not installed/);
  assert.match(result.body.error, /approved booking payment migration/);
});

test("other missing relations and database errors remain server failures", () => {
  assert.deepEqual(
    createMyRequestsErrorResponse({
      code: "42P01",
      message: 'relation "request_status_history" does not exist',
    }),
    {
      status: 500,
      body: { error: "Could not load your requests. Please try again." },
    }
  );
  assert.equal(
    createMyRequestsErrorResponse(new Error("database unavailable")).status,
    500
  );
});

test("My Requests parser returns successful request arrays", async () => {
  const requests = [{ id: "request-1", bookingPayments: [] }];
  assert.deepEqual(
    await readMyRequestsResponse(response(JSON.stringify({ requests }))),
    { ok: true, requests }
  );
});

test("My Requests parser returns HTTP 503 errors as inline-ready results", async () => {
  assert.deepEqual(
    await readMyRequestsResponse(response(JSON.stringify({
      error: "Payment history requires the approved migration.",
    }), 503)),
    { ok: false, error: "Payment history requires the approved migration." }
  );
});

test("My Requests parser returns errors for empty, malformed, and invalid responses", async () => {
  assert.deepEqual(
    await readMyRequestsResponse(response("")),
    {
      ok: false,
      error: "The server returned an invalid response while loading your requests. Please try again.",
    }
  );
  assert.deepEqual(
    await readMyRequestsResponse(response("<html>failure</html>")),
    {
      ok: false,
      error: "The server returned an invalid response while loading your requests. Please try again.",
    }
  );
  assert.deepEqual(
    await readMyRequestsResponse(response(JSON.stringify({}))),
    { ok: false, error: "The server returned incomplete request data. Please try again." }
  );
});
