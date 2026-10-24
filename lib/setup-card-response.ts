const SETUP_ERROR = "Could not start payment setup. Please try again.";

export function createSetupCardErrorResponse(error?: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "StripeConfigurationError" &&
    "issue" in error &&
    (error.issue === "missing" || error.issue === "test_mode_required")
  ) {
    return {
      status: 503,
      body: {
        error: error.issue === "missing"
          ? "Payment setup is unavailable because the server is missing its Stripe test-mode configuration."
          : "Payment setup is unavailable because the server requires a Stripe test-mode secret key.",
      },
    };
  }

  return {
    status: 500,
    body: { error: SETUP_ERROR },
  };
}

export type SetupCardResponse =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function readSetupCardResponse(
  response: Response
): Promise<SetupCardResponse> {
  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: response.ok
        ? "The server returned an invalid payment setup response. Please try again."
        : `Could not start payment setup (server returned ${response.status}). Please try again.`,
    };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Could not start payment setup (server returned ${response.status}). Please try again.`;
    return { ok: false, error: message };
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("url" in data) ||
    typeof data.url !== "string" ||
    data.url.length === 0
  ) {
    return {
      ok: false,
      error: "The payment setup response did not include a checkout URL.",
    };
  }

  return { ok: true, url: data.url };
}
