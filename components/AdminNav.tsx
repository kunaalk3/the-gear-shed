"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/items", label: "Inventory" },
  { href: "/admin/organisations", label: "Organisations" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [pendingOrgs, setPendingOrgs] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/requests").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/organisations?status=pending").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([reqData, orgData]) => {
        const requests: { status: string }[] = reqData?.requests ?? [];
        setPendingRequests(requests.filter((r) => r.status === "pending").length);
        setPendingOrgs((orgData?.organisations ?? []).length);
      })
      .catch(() => {});
  }, []);

  const badgeCount: Record<string, number> = {
    "/admin/requests": pendingRequests,
    "/admin/organisations": pendingOrgs,
  };

  return (
    <nav className="flex flex-wrap gap-2 border-b border-canvas-line pb-4">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        const count = badgeCount[link.href] ?? 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-standard relative rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
              active
                ? "border-pine bg-pine text-canvas"
                : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
            }`}
          >
            {link.label}
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brick px-1 font-tag text-[0.65rem] font-bold text-canvas">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
