const PAYMENT_SCHEMA_ERROR =
  "Payment history is unavailable because the booking payment schema is not installed. Ask an administrator to apply the approved booking payment migration.";

export function createMyRequestsErrorResponse(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01" &&
    "message" in error &&
    typeof error.message === "string" &&
    /relation\s+["']?(?:public\.)?booking_payments["']?\s+does not exist/i.test(error.message)
  ) {
    return { status: 503, body: { error: PAYMENT_SCHEMA_ERROR } };
  }

  return {
    status: 500,
    body: { error: "Could not load your requests. Please try again." },
  };
}

export type MyRequestsResponse<T> =
  | { ok: true; requests: T[] }
  | { ok: false; error: string };

export async function readMyRequestsResponse<T>(
  response: Response
): Promise<MyRequestsResponse<T>> {
  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      return {
        ok: false,
        error: `Could not load your requests (server returned ${response.status}).`,
      };
    }
    return {
      ok: false,
      error: "The server returned an invalid response while loading your requests. Please try again.",
    };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Could not load your requests (server returned ${response.status}).`;
    return { ok: false, error: message };
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("requests" in data) ||
    !Array.isArray(data.requests)
  ) {
    return {
      ok: false,
      error: "The server returned incomplete request data. Please try again.",
    };
  }

  return { ok: true, requests: data.requests as T[] };
}
