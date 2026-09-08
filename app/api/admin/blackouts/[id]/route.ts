import { NextResponse } from "next/server";
import { deleteBlackout } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const deleted = await deleteBlackout(id);
  if (!deleted) return NextResponse.json({ error: "Blackout not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
