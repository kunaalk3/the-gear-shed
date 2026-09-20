import { NextResponse } from "next/server";
import { getReviewSummaryForItem, getReviewsForItem } from "@/lib/data/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [reviews, summary] = await Promise.all([getReviewsForItem(id), getReviewSummaryForItem(id)]);
  return NextResponse.json({ reviews, summary });
}
