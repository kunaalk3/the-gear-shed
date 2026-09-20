import { NextRequest, NextResponse } from "next/server";
import { declineRequest, getItemById, getRequestById } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const item = await getItemById(existing.itemId, { includeRetired: true });
  if (!item || item.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "You can only act on requests for your own items." }, { status: 403 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be declined." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const note = body?.note ? String(body.note).trim() : "";

  const updated = await declineRequest(id, note);
  await notifyUser(existing.userId, "request_declined", `Your request for ${item.name} was declined`, "/my-requests");

  return NextResponse.json({ request: updated });
}
