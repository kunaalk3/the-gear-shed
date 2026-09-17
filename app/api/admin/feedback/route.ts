import { NextResponse } from "next/server";
import { getAllFeedback } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const feedback = await getAllFeedback();
  return NextResponse.json({ feedback });
}
