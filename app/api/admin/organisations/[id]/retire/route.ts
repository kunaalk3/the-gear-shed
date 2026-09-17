import { NextResponse } from "next/server";
import { retireOrg, getUserById } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";

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
  if (existing.orgStatus !== "approved") {
    return NextResponse.json({ error: "Only approved organisations can be retired." }, { status: 409 });
  }

  const updated = await retireOrg(id);
  return NextResponse.json({ organisation: updated ? toPublicUser(updated) : null });
}
