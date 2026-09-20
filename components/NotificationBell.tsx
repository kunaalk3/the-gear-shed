"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/types";

const POLL_MS = 30_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setUnread(data.unread ?? 0);
        setNotifications(data.notifications ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpen() {
    setOpen((o) => !o);
  }

  async function handleSelect(notification: AppNotification) {
    setOpen(false);
    if (!notification.read) {
      setUnread((n) => Math.max(0, n - 1));
      fetch(`/api/notifications/${notification.id}/read`, { method: "POST" }).catch(() => {});
    }
    if (notification.link) router.push(notification.link);
  }

  async function handleMarkAllRead() {
    setUnread(0);
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="transition-standard relative rounded-full border border-canvas/40 p-2 hover:border-amber hover:text-amber"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brick px-1 font-tag text-[0.65rem] font-bold text-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-canvas-line bg-canvas text-ink shadow-xl">
          <div className="flex items-center justify-between border-b border-canvas-line px-4 py-2.5">
            <p className="font-tag text-xs uppercase tracking-widest text-ink/60">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="font-tag text-[0.65rem] uppercase tracking-wide text-pine hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center font-body text-sm text-ink/50">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleSelect(n)}
                  className={`transition-standard block w-full border-b border-canvas-line/60 px-4 py-3 text-left last:border-b-0 hover:bg-canvas-dark/60 ${
                    n.read ? "" : "bg-amber/10"
                  }`}
                >
                  <p className="font-body text-sm text-ink">{n.message}</p>
                  <p className="mt-0.5 font-tag text-[0.65rem] uppercase tracking-wide text-ink/40">
                    {timeAgo(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
