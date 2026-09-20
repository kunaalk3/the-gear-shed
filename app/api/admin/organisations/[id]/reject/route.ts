import { NextResponse } from "next/server";
import { rejectOrg, getUserById } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing || existing.role !== "org") {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }
  if (existing.orgStatus !== "pending") {
    return NextResponse.json({ error: "Only pending organisations can be rejected." }, { status: 409 });
  }

  const updated = await rejectOrg(id);
  if (updated) {
    await notifyUser(updated.id, "org_rejected", "Your organisation application wasn't approved", "/org/items");
  }
  return NextResponse.json({ organisation: updated ? toPublicUser(updated) : null });
}
