import { NextResponse } from "next/server";
import { approveRequest, getRequestById } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 });
  }

  const updated = await approveRequest(id);
  return NextResponse.json({ request: updated });
}
