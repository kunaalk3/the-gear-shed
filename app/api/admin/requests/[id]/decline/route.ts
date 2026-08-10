import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const loanRequest = store.requests.find((r) => r.id === id);
  if (!loanRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (loanRequest.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be declined." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { note } = body ?? {};

  loanRequest.status = "declined";
  loanRequest.adminNote = note ? String(note).trim() : "";
  loanRequest.reviewedAt = new Date().toISOString();

  // Declining frees the reserved quantity straight back up.
  const bookingIndex = store.bookings.findIndex((b) => b.requestId === id);
  if (bookingIndex !== -1) store.bookings.splice(bookingIndex, 1);

  return NextResponse.json({ request: loanRequest });
}
