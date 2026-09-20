import { NextRequest, NextResponse } from "next/server";
import { getRequestsForOwner } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import type { LoanRequestStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as LoanRequestStatus | null;

  const requests = await getRequestsForOwner(auth.user.id, status);
  return NextResponse.json({ requests });
}
