import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createReview, getRequestById, getReviewedRequestIds } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { requestId, rating, comment } = body ?? {};

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
  }

  const loanRequest = await getRequestById(requestId);
  if (!loanRequest || loanRequest.userId !== user.id) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (loanRequest.status !== "approved") {
    return NextResponse.json({ error: "You can only review items you actually borrowed." }, { status: 409 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (loanRequest.endDate > today) {
    return NextResponse.json({ error: "You can review this once the loan period has ended." }, { status: 409 });
  }

  const alreadyReviewed = await getReviewedRequestIds(user.id);
  if (alreadyReviewed.has(requestId)) {
    return NextResponse.json({ error: "You've already reviewed this request." }, { status: 409 });
  }

  const review = await createReview({
    id: randomUUID(),
    requestId,
    itemId: loanRequest.itemId,
    userId: user.id,
    rating: ratingNum,
    comment: comment ? String(comment).trim() : "",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ review }, { status: 201 });
}
