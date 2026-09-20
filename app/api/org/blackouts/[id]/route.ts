import { NextResponse } from "next/server";
import { deleteBlackout, getBlackoutById, getItemById } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const blackout = await getBlackoutById(id);
  if (!blackout) return NextResponse.json({ error: "Blackout not found." }, { status: 404 });

  const item = await getItemById(blackout.itemId, { includeRetired: true });
  if (!item || item.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "Blackout not found." }, { status: 404 });
  }

  await deleteBlackout(id);
  return NextResponse.json({ ok: true });
}
