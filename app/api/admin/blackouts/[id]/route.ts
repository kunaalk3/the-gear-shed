import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const index = store.blackouts.findIndex((b) => b.id === id);
  if (index === -1) return NextResponse.json({ error: "Blackout not found." }, { status: 404 });

  store.blackouts.splice(index, 1);
  return NextResponse.json({ ok: true });
}
