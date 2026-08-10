import type { BlackoutPeriod, Booking } from "@/lib/types";

function parseIsoDateUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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

/** Reserved quantity (pending + approved bookings) for each day in [startDate, endDate]. */
export function reservedByDay(
  bookings: Booking[],
  startDate: string,
  endDate: string
): Record<string, number> {
  const days = dateRange(startDate, endDate);
  const result: Record<string, number> = {};
  for (const day of days) {
    result[day] = bookings
      .filter((b) => overlaps(b.startDate, b.endDate, day, day))
      .reduce((sum, b) => sum + b.quantity, 0);
  }
  return result;
}

/** The largest reserved quantity on any single day within [startDate, endDate]. */
export function maxReservedInRange(
  bookings: Booking[],
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
