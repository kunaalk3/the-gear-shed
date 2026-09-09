import { NextRequest, NextResponse } from "next/server";
import { getOrgAccounts } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";
import type { OrgStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as OrgStatus | null;

  const organisations = await getOrgAccounts(status);
  return NextResponse.json({ organisations: organisations.map(toPublicUser) });
}
