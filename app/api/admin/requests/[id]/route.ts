import { NextRequest, NextResponse } from "next/server";
import { getRequestById, setBadHire } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.badHire !== "boolean") {
    return NextResponse.json({ error: "badHire (boolean) is required." }, { status: 400 });
  }

  const updated = await setBadHire(id, body.badHire);
  return NextResponse.json({ request: updated });
}
