import { NextResponse } from "next/server";
import { getRequestsForUser, getReviewedRequestIds } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const [requests, reviewedIds] = await Promise.all([
    getRequestsForUser(user.id),
    getReviewedRequestIds(user.id),
  ]);
  const withReviewFlag = requests.map((r) => ({ ...r, reviewed: reviewedIds.has(r.id) }));

  return NextResponse.json({ requests: withReviewFlag });
}
