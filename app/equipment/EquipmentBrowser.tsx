"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category, EquipmentItem } from "@/lib/types";
import EquipmentCard from "@/components/EquipmentCard";
import CategoryFilter from "@/components/CategoryFilter";

export default function EquipmentBrowser() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const category = searchParams.get("category") as Category | null;
  const search = searchParams.get("search") ?? "";

  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);

    let cancelled = false;
    setLoading(true);
    fetch(`/api/items?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, search]);

  function updateParams(next: { category?: Category | null; search?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if ("category" in next) {
      if (next.category) params.set("category", next.category);
      else params.delete("category");
    }
    if ("search" in next) {
      if (next.search) params.set("search", next.search);
      else params.delete("search");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-tag text-xs uppercase tracking-widest text-pine/70">
            The shed inventory
          </p>
          <h1 className="font-display text-4xl font-bold text-pine">Browse equipment</h1>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ search: searchInput });
          }}
          className="flex gap-2"
        >
          <label htmlFor="search" className="sr-only">
            Search equipment
          </label>
          <input
            id="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search the shed…"
            className="w-full min-w-0 rounded-full border border-canvas-line bg-white/70 px-4 py-2 font-body text-sm outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine sm:w-56"
          />
          <button className="transition-standard shrink-0 rounded-full bg-pine px-4 py-2 font-body text-sm text-canvas hover:bg-pine-light">
            Search
          </button>
        </form>
      </div>

      <CategoryFilter active={category} onSelect={(next) => updateParams({ category: next })} />

      {loading ? (
        <p className="mt-10 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-10 font-body text-ink/60">
          Nothing matches yet — try a different category or search term.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <EquipmentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
