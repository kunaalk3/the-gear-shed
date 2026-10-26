import assert from "node:assert/strict";
import test from "node:test";
import { readOrgRequestsResponse } from "./org-requests-response.ts";

function response(body, { status = 200, contentType = "application/json" } = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType },
  });
}

test("reads request arrays from successful JSON responses", async () => {
  const requests = [{ id: "request-1", status: "pending" }];
  assert.deepEqual(
    await readOrgRequestsResponse(response(JSON.stringify({ requests }))),
    requests
  );
});

test("uses the API error message from non-OK JSON responses", async () => {
  await assert.rejects(
    readOrgRequestsResponse(response(JSON.stringify({ error: "Organisation access required." }), { status: 403 })),
    { message: "Organisation access required." }
  );
});

test("handles empty or malformed successful responses without JSON parse errors", async () => {
  await assert.rejects(
    readOrgRequestsResponse(response("")),
    { message: "The server returned an invalid response while loading requests. Please try again." }
  );
  await assert.rejects(
    readOrgRequestsResponse(response("<html>failure</html>")),
    { message: "The server returned an invalid response while loading requests. Please try again." }
  );
});

test("reports non-JSON server failures with their HTTP status", async () => {
  await assert.rejects(
    readOrgRequestsResponse(response("", { status: 500 })),
    { message: "Could not load requests (server returned 500)." }
  );
});

test("rejects successful JSON without a requests array", async () => {
  await assert.rejects(
    readOrgRequestsResponse(response(JSON.stringify({}))),
    { message: "The server returned invalid request data. Please try again." }
  );
});
