"use client";

import { useEffect, useState } from "react";

const POLL_MS = 30_000;

export default function AdminNotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/admin/notifications")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data) setCount(data.total ?? 0);
        })
        .catch(() => {});
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} items need admin review`}
      className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brick px-1 font-tag text-[0.65rem] font-bold text-canvas"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
