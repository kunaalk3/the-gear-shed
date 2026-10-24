export async function readOrgRequestsResponse<T>(response: Response): Promise<T[]> {
  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(`Could not load requests (server returned ${response.status}).`);
    }
    throw new Error("The server returned an invalid response while loading requests. Please try again.");
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Could not load requests (server returned ${response.status}).`;
    throw new Error(message);
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("requests" in data) ||
    !Array.isArray(data.requests)
  ) {
    throw new Error("The server returned invalid request data. Please try again.");
  }

  return data.requests as T[];
}
