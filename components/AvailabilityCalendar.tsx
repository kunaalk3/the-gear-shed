"use client";

import { useEffect, useState } from "react";
import { availabilityLevel, calendarDateOverride } from "@/lib/availability";

interface BlackoutSummary {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AvailabilityCalendar({
  itemId,
}: {
  itemId: string;
}) {
  const [availableByDay, setAvailableByDay] = useState<Record<string, number>>({});
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [blackouts, setBlackouts] = useState<BlackoutSummary[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  useEffect(() => {
    let cancelled = false;
    const startDate = isoDate(year, month, 1);
    const endDate = isoDate(year, month, daysInMonth);
    fetch(`/api/items/${itemId}/bookings?startDate=${startDate}&endDate=${endDate}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Availability request failed (${res.status}).`);
        return res.json();
      })
      .then((data) => {
        if (
          typeof data.totalQuantity !== "number" ||
          !data.availableByDay ||
          typeof data.availableByDay !== "object" ||
          Array.isArray(data.availableByDay) ||
          !Array.isArray(data.blackouts)
        ) {
          throw new Error("Availability response is incomplete.");
        }
        if (!cancelled) {
          setAvailabilityError(null);
          setAvailableByDay(data.availableByDay);
          setTotalQuantity(data.totalQuantity);
          setBlackouts(data.blackouts);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error("Unable to load item availability.", error);
          setAvailabilityError("Availability could not be loaded. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, year, month, daysInMonth]);

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function statusFor(day: number): "past" | "blackout" | "full" | "limited" | "available" {
    const iso = isoDate(year, month, day);
    const dateOverride = calendarDateOverride(iso, todayIso, blackouts);
    if (dateOverride) return dateOverride;
    const remaining = availableByDay[iso];
    if (remaining === undefined) return "full";
    return availabilityLevel(remaining, totalQuantity);
  }

  const dotClass: Record<string, string> = {
    past: "bg-canvas-line/60",
    blackout: "bg-ink/60",
    full: "bg-brick",
    limited: "bg-amber",
    available: "bg-moss",
  };

  return (
    <div className="gear-tag p-4">
      <div className="mb-3 flex items-center justify-between pl-4">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            setLoading(true);
            setMonthOffset((m) => m - 1);
          }}
          disabled={monthOffset <= 0}
          className="rounded-full px-2 py-1 font-tag text-sm text-pine transition-standard hover:bg-canvas-dark disabled:opacity-30"
        >
          ‹
        </button>
        <p className="font-tag text-xs uppercase tracking-widest text-pine">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => {
            setLoading(true);
            setMonthOffset((m) => m + 1);
          }}
          className="rounded-full px-2 py-1 font-tag text-sm text-pine transition-standard hover:bg-canvas-dark"
        >
          ›
        </button>
      </div>

      {loading ? (
        <p className="pl-4 font-tag text-xs uppercase tracking-wide text-ink/50">Loading availability…</p>
      ) : (
        availabilityError ? (
          <p className="pl-4 font-tag text-xs uppercase tracking-wide text-brick">
            {availabilityError}
          </p>
        ) : (
        <>
          <div className="grid grid-cols-7 gap-1 pl-4 pr-1">
            {WEEKDAYS.map((day, i) => (
              <div key={i} className="text-center font-tag text-[0.65rem] uppercase text-ink/40">
                {day}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const status = statusFor(day);
              return (
                <div
                  key={i}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-xs"
                  title={status === "past" ? undefined : status}
                >
                  <span className={status === "past" ? "text-ink/30" : "text-ink/80"}>{day}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass[status]}`} />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 pl-4 font-tag text-[0.65rem] uppercase tracking-wide text-ink/60">
            <Legend swatch="bg-moss" label="Available" />
            <Legend swatch="bg-amber" label="Limited" />
            <Legend swatch="bg-brick" label="Fully booked" />
            <Legend swatch="bg-ink/60" label="Unavailable" />
          </div>
        </>
        )
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
