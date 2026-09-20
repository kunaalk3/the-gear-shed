"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/org/items", label: "Our items" },
  { href: "/org/requests", label: "Requests" },
];

export default function OrgNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-canvas-line pb-4">
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
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
