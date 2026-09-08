import { NextRequest, NextResponse } from "next/server";
import { declineRequest, getRequestById } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be declined." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { note } = body ?? {};

  // Declining frees the reserved quantity straight back up.
  const updated = await declineRequest(id, note ? String(note).trim() : "");
  return NextResponse.json({ request: updated });
}
