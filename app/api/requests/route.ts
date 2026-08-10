import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { getCurrentUser } from "@/lib/auth";
import { isBlackedOut, maxReservedInRange } from "@/lib/availability";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Log in to submit a loan request." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const { itemId, startDate, endDate, quantity, notes } = body ?? {};

  if (!itemId || !startDate || !endDate || !quantity) {
    return NextResponse.json(
      { error: "Item, dates and quantity are required." },
      { status: 400 }
    );
  }

  const item = store.items.find((i) => i.id === itemId && !i.retired);
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  const qty = Number(quantity);
  const today = new Date().toISOString().slice(0, 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
  }
  if (startDate < today) {
    return NextResponse.json({ error: "Start date can't be in the past." }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: "End date can't be before the start date." }, { status: 400 });
  }

  const itemBlackouts = store.blackouts.filter((b) => b.itemId === itemId);
  if (isBlackedOut(itemBlackouts, startDate, endDate)) {
    return NextResponse.json(
      { error: "This item is unavailable for those dates." },
      { status: 409 }
    );
  }

  const itemBookings = store.bookings.filter((b) => b.itemId === itemId);
  const reserved = maxReservedInRange(itemBookings, startDate, endDate);
  const available = item.totalQuantity - reserved;
  if (qty > available) {
    return NextResponse.json(
      {
        error:
          available > 0
            ? `Only ${available} available for those dates.`
            : "None available for those dates.",
      },
      { status: 409 }
    );
  }

  const requestId = randomUUID();
  const loanRequest = {
    id: requestId,
    itemId,
    userId: user.id,
    requesterName: user.name,
    requesterEmail: user.email,
    requesterOrganisation: user.organisation,
    requesterPhone: user.phone,
    startDate,
    endDate,
    quantity: qty,
    notes: notes ? String(notes).trim() : "",
    status: "pending" as const,
    adminNote: "",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  store.requests.push(loanRequest);
  store.bookings.push({
    id: randomUUID(),
    itemId,
    requestId,
    startDate,
    endDate,
    quantity: qty,
    status: "pending",
  });

  return NextResponse.json({ request: loanRequest }, { status: 201 });
}
