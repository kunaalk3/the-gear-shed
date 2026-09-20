import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const { id } = await params;
  await markNotificationRead(id, user.id);
  return NextResponse.json({ ok: true });
}
