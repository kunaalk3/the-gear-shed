import { NextResponse } from "next/server";
import { getOrgAccounts, getRequestsWithItemNames } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [pendingRequests, pendingOrganisations] = await Promise.all([
    getRequestsWithItemNames("pending"),
    getOrgAccounts("pending"),
  ]);

  return NextResponse.json({
    pendingRequests: pendingRequests.length,
    pendingOrganisations: pendingOrganisations.length,
    total: pendingRequests.length + pendingOrganisations.length,
  });
}
