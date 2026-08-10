import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const loanRequest = store.requests.find((r) => r.id === id);
  if (!loanRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (loanRequest.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 });
  }

  loanRequest.status = "approved";
  loanRequest.reviewedAt = new Date().toISOString();

  const booking = store.bookings.find((b) => b.requestId === id);
  if (booking) booking.status = "approved";

  return NextResponse.json({ request: loanRequest });
}
