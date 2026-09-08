import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createBlackout, getItemById } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const item = await getItemById(id, { includeRetired: true });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const { startDate, endDate, reason } = body ?? {};

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date can't be before the start date." }, { status: 400 });
  }

  const blackout = await createBlackout({
    id: randomUUID(),
    itemId: id,
    startDate,
    endDate,
    reason: reason ? String(reason).trim() : "",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ blackout }, { status: 201 });
}
