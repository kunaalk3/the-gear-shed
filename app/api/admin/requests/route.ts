import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { requireAdmin } from "@/lib/auth";
import type { LoanRequestStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as LoanRequestStatus | null;

  let requests = store.requests;
  if (status) {
    requests = requests.filter((r) => r.status === status);
  }

  const withItem = requests
    .map((r) => {
      const item = store.items.find((i) => i.id === r.itemId);
      return { ...r, itemName: item?.name ?? "Unknown item" };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ requests: withItem });
}
