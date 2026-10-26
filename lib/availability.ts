import type { BlackoutPeriod, Booking } from "@/lib/types";

export type FulfillmentStatus =
  | "not_started"
  | "collected"
  | "returned"
  | "donation_completed"
  | "legacy_unknown";

export type FulfillmentEventType =
  | "collection_confirmed"
  | "return_inspected"
  | "donation_handover_confirmed";

export interface AvailabilityEvent {
  eventType: FulfillmentEventType;
  occurredAt: string;
  quantity: number;
}

export interface AvailabilityBooking extends Pick<
  Booking,
  "startDate" | "endDate" | "quantity" | "status"
> {
  id: string;
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentEvents: AvailabilityEvent[];
}

function parseIsoDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = parseIsoDateUtc(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Builds entirely in UTC (Date.UTC in, setUTCDate/toISOString out) so this never
// drifts a day in timezones ahead of UTC — e.g. new Date("2026-08-15T00:00:00")
// parses as *local* midnight, and toISOString() on that in a UTC+ timezone
// rolls back to the previous UTC day, silently under-counting reservations.
export function dateRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cur = parseIsoDateUtc(startDate);
  const end = parseIsoDateUtc(endDate);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

function eventDate(event: AvailabilityEvent): string {
  return event.occurredAt.slice(0, 10);
}

function reservedOnDay(booking: AvailabilityBooking, day: string): number {
  if (booking.fulfillmentStatus === "donation_completed") return 0;

  const collections = booking.fulfillmentEvents.filter(
    (event) => event.eventType === "collection_confirmed"
  );
  const returns = booking.fulfillmentEvents.filter(
    (event) => event.eventType === "return_inspected"
  );
  const collectedByDay = collections
    .filter((event) => eventDate(event) <= day)
    .reduce((sum, event) => sum + event.quantity, 0);
  const returnedBeforeDay = returns
    .filter((event) => eventDate(event) < day)
    .reduce((sum, event) => sum + event.quantity, 0);

  const scheduled =
    booking.status === "approved" &&
    booking.startDate <= day &&
    day <= booking.endDate
      ? Math.max(0, booking.quantity - collectedByDay)
      : 0;
  const checkedOut = Math.max(0, collectedByDay - returnedBeforeDay);
  const hasCollectionEvidence = collections.length > 0;
  const fulfillmentIsUncertain =
    booking.fulfillmentStatus === "legacy_unknown" ||
    ((booking.fulfillmentStatus === "collected" ||
      booking.fulfillmentStatus === "returned") &&
      !hasCollectionEvidence);
  const overdueUnknownQuantity =
    booking.status === "approved" &&
    fulfillmentIsUncertain &&
    day > booking.endDate
      ? Math.max(
          0,
          booking.quantity -
            collections.reduce((sum, event) => sum + event.quantity, 0)
        )
      : 0;

  return scheduled + checkedOut + overdueUnknownQuantity;
}

function addDays(isoDate: string, amount: number): string {
  const date = parseIsoDateUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function commitmentCheckDates(bookings: AvailabilityBooking[]): string[] {
  const dates = new Set<string>();
  for (const booking of bookings) {
    dates.add(booking.startDate);
    dates.add(booking.endDate);
    dates.add(addDays(booking.endDate, 1));
    for (const event of booking.fulfillmentEvents) {
      const day = eventDate(event);
      dates.add(day);
      dates.add(addDays(day, 1));
    }
  }
  return [...dates].sort();
}

/** Greatest simultaneous commitment across reservation and checkout date boundaries. */
export function maxCommittedQuantity(bookings: AvailabilityBooking[]): number {
  return commitmentCheckDates(bookings).reduce(
    (maximum, day) =>
      Math.max(
        maximum,
        bookings.reduce((sum, booking) => sum + reservedOnDay(booking, day), 0)
      ),
    0
  );
}

export function canReduceInventoryTo(
  bookings: AvailabilityBooking[],
  totalQuantity: number
): boolean {
  return Number.isInteger(totalQuantity) && totalQuantity >= maxCommittedQuantity(bookings);
}

/** Remaining inventory for each day in [startDate, endDate]. */
export function availableByDay(
  bookings: AvailabilityBooking[],
  totalQuantity: number,
  startDate: string,
  endDate: string,
  blackouts: Pick<BlackoutPeriod, "startDate" | "endDate">[] = []
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const day of dateRange(startDate, endDate)) {
    if (blackouts.some((blackout) => overlaps(blackout.startDate, blackout.endDate, day, day))) {
      result[day] = 0;
      continue;
    }
    const reserved = bookings.reduce((sum, booking) => sum + reservedOnDay(booking, day), 0);
    result[day] = Math.max(0, totalQuantity - reserved);
  }
  return result;
}

export function minAvailableInRange(
  bookings: AvailabilityBooking[],
  totalQuantity: number,
  startDate: string,
  endDate: string,
  blackouts: Pick<BlackoutPeriod, "startDate" | "endDate">[] = []
): number {
  const values = Object.values(availableByDay(bookings, totalQuantity, startDate, endDate, blackouts));
  return values.length > 0 ? Math.min(...values) : 0;
}

export function availabilityLevel(
  availableQuantity: number,
  totalQuantity: number
): "full" | "limited" | "available" {
  if (availableQuantity <= 0) return "full";
  return availableQuantity < totalQuantity ? "limited" : "available";
}

/** Confirmed reservation and checkout quantity for each day in [startDate, endDate]. */
export function reservedByDay(
  bookings: AvailabilityBooking[],
  startDate: string,
  endDate: string
): Record<string, number> {
  const days = dateRange(startDate, endDate);
  const result: Record<string, number> = {};
  for (const day of days) {
    result[day] = bookings.reduce((sum, booking) => sum + reservedOnDay(booking, day), 0);
  }
  return result;
}

/** The largest reserved quantity on any single day within [startDate, endDate]. */
export function maxReservedInRange(
  bookings: AvailabilityBooking[],
  startDate: string,
  endDate: string
): number {
  const byDay = reservedByDay(bookings, startDate, endDate);
  const values = Object.values(byDay);
  return values.length ? Math.max(...values) : 0;
}

/** True if any blackout period overlaps [startDate, endDate] — a blackout takes the whole item off the market for those dates. */
export function isBlackedOut(
  blackouts: BlackoutPeriod[],
  startDate: string,
  endDate: string
): boolean {
  return blackouts.some((b) => overlaps(b.startDate, b.endDate, startDate, endDate));
}

/** The blackout period covering a single day, if any. */
export function blackoutOnDay(blackouts: BlackoutPeriod[], day: string): BlackoutPeriod | undefined {
  return blackouts.find((b) => overlaps(b.startDate, b.endDate, day, day));
}

export function calendarDateOverride(
  day: string,
  today: string,
  blackouts: Pick<BlackoutPeriod, "startDate" | "endDate">[]
): "past" | "blackout" | null {
  if (blackouts.some((blackout) => overlaps(blackout.startDate, blackout.endDate, day, day))) {
    return "blackout";
  }
  return day < today ? "past" : null;
}
