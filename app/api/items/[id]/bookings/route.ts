import { NextResponse } from "next/server";
import { getBlackoutsForItem, getBookingsForItem, getItemById } from "@/lib/data/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getItemById(id, { includeRetired: true });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const bookings = (await getBookingsForItem(id)).map(({ id, startDate, endDate, quantity, status }) => ({
    id,
    startDate,
    endDate,
    quantity,
    status,
  }));

  const blackouts = (await getBlackoutsForItem(id)).map(({ id, startDate, endDate, reason }) => ({
    id,
    startDate,
    endDate,
    reason,
  }));

  return NextResponse.json({ bookings, blackouts, totalQuantity: item.totalQuantity });
}
