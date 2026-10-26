import { NextResponse } from "next/server";
import { availableByDay, isIsoDate } from "@/lib/availability";
import { getAvailabilityBookingsForItem, getBlackoutsForItem, getItemById } from "@/lib/data/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getItemById(id, { includeRetired: true });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedStart = searchParams.get("startDate");
  const requestedEnd = searchParams.get("endDate");
  if (
    (requestedStart !== null || requestedEnd !== null) &&
    (!isIsoDate(requestedStart) ||
      !isIsoDate(requestedEnd) ||
      requestedStart > requestedEnd)
  ) {
    return NextResponse.json({ error: "A valid date range is required." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const startDate = requestedStart ?? `${today.slice(0, 7)}-01`;
  const endDate =
    requestedEnd ??
    new Date(Date.UTC(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)),
      0
    )).toISOString().slice(0, 10);
  const [availabilityBookings, itemBlackouts] = await Promise.all([
    getAvailabilityBookingsForItem(id),
    getBlackoutsForItem(id),
  ]);
  const bookings = availabilityBookings
    .filter(({ status }) => status !== "cancelled")
    .map(({ id, startDate, endDate, quantity, status }) => ({
      id,
      startDate,
      endDate,
      quantity,
      status,
    }));

  const blackouts = itemBlackouts.map(({ id, startDate, endDate, reason }) => ({
    id,
    startDate,
    endDate,
    reason,
  }));

  return NextResponse.json({
    bookings,
    blackouts,
    totalQuantity: item.totalQuantity,
    availableByDay: availableByDay(
      availabilityBookings,
      item.totalQuantity,
      startDate,
      endDate,
      itemBlackouts
    ),
  });
}
