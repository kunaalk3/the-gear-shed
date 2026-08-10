"use client";

import { CATEGORIES, type Category } from "@/lib/types";

export default function CategoryFilter({
  active,
  onSelect,
}: {
  active: Category | null;
  onSelect: (category: Category | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      <Pill label="All" isActive={active === null} onClick={() => onSelect(null)} />
      {CATEGORIES.map((category) => (
        <Pill
          key={category}
          label={category}
          isActive={active === category}
          onClick={() => onSelect(category)}
        />
      ))}
    </div>
  );
}

function Pill({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-pine focus-visible:outline-none ${
        isActive
          ? "border-pine bg-pine text-canvas"
          : "border-canvas-line bg-canvas-dark/60 text-ink/70 hover:border-pine hover:text-pine"
      }`}
    >
      {label}
    </button>
  );
}
