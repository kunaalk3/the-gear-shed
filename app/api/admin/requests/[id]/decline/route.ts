import { NextRequest, NextResponse } from "next/server";
import { declineRequest, getItemById, getRequestById } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

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
  const updated = await declineRequest(id, note ? String(note).trim() : "", auth.user.id);
  if (!updated) return NextResponse.json({ error: "Only pending requests can be declined." }, { status: 409 });
  const item = await getItemById(existing.itemId, { includeRetired: true });
  await notifyUser(
    existing.userId,
    "request_declined",
    `Your request for ${item?.name ?? "an item"} was declined`,
    "/my-requests"
  );

  return NextResponse.json({ request: updated });
}
