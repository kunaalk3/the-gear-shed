import { NextResponse } from "next/server";
import { getRequestsForUser, getReviewedRequestIds } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";
import { createMyRequestsErrorResponse } from "@/lib/my-requests-response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

    const [requests, reviewedIds] = await Promise.all([
      getRequestsForUser(user.id),
      getReviewedRequestIds(user.id),
    ]);
    const withReviewFlag = requests.map((r) => ({ ...r, reviewed: reviewedIds.has(r.id) }));

    return NextResponse.json({ requests: withReviewFlag });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z0-9]{5}$/.test(error.code)
        ? error.code
        : undefined;
    console.error("Failed to load requester history.", { errorName, errorCode });
    const result = createMyRequestsErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
