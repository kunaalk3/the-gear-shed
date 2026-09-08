import { NextRequest, NextResponse } from "next/server";
import { getRequestsWithItemNames } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import type { LoanRequestStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as LoanRequestStatus | null;

  const requests = await getRequestsWithItemNames(status);
  return NextResponse.json({ requests });
}
