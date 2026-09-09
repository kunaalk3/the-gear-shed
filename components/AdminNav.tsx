"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/items", label: "Inventory" },
  { href: "/admin/organisations", label: "Organisations" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-canvas-line pb-4">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
              active
                ? "border-pine bg-pine text-canvas"
                : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
