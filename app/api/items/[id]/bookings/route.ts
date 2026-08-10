import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const bookings = store.bookings
    .filter((b) => b.itemId === id)
    .map(({ id, startDate, endDate, quantity, status }) => ({
      id,
      startDate,
      endDate,
      quantity,
      status,
    }));

  const blackouts = store.blackouts
    .filter((b) => b.itemId === id)
    .map(({ id, startDate, endDate, reason }) => ({ id, startDate, endDate, reason }));

  return NextResponse.json({ bookings, blackouts, totalQuantity: item.totalQuantity });
}
