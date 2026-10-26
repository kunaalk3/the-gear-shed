import { NextRequest, NextResponse } from "next/server";
import { getRequestsForOwner } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import type { LoanRequestStatus } from "@/lib/types";

function isLoanRequestStatus(value: string): value is LoanRequestStatus {
  return value === "pending" ||
    value === "approved" ||
    value === "declined" ||
    value === "cancelled";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOrg();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const requestedStatus = searchParams.get("status");
    let status: LoanRequestStatus | null = null;
    if (requestedStatus) {
      if (!isLoanRequestStatus(requestedStatus)) {
        return NextResponse.json({ error: "Invalid request status filter." }, { status: 400 });
      }
      status = requestedStatus;
    }

    const requests = await getRequestsForOwner(auth.user.id, status);
    return NextResponse.json({ requests });
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
    console.error("Failed to load organization requests.", { errorName, errorCode });
    return NextResponse.json(
      { error: "Could not load organization requests. Please try again." },
      { status: 500 }
    );
  }
}
