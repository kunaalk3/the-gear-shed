"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import type { EquipmentItem } from "@/lib/types";

export default function AdminItemsPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function toggleRetired(item: EquipmentItem) {
    setBusyId(item.id);
    await fetch(`/api/admin/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retired: !item.retired }),
    });
    setBusyId(null);
    load();
  }

  if (!ready) return <Loading />;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-pine">Inventory</h1>
        </div>
        <Link
          href="/admin/items/new"
          className="transition-standard shrink-0 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark"
        >
          + Add item
        </Link>
      </div>

      <div className="mt-6">
        <AdminNav />
      </div>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`gear-tag flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                item.retired ? "opacity-60" : ""
              }`}
            >
              <div className="pl-3">
                <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                  {item.category}
                  {item.retired ? " · Retired" : ""}
                </p>
                <p className="font-display text-lg font-bold text-ink">{item.name}</p>
                <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                  x{item.totalQuantity} in the shed
                  {item.depositRequired > 0 ? ` · $${item.depositRequired} deposit` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/items/${item.id}/edit`}
                  className="transition-standard rounded-full border border-canvas-line px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-ink/70 hover:border-pine hover:text-pine"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => toggleRetired(item)}
                  disabled={busyId === item.id}
                  className={`transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide disabled:opacity-50 ${
                    item.retired
                      ? "border-moss text-moss hover:bg-moss hover:text-canvas"
                      : "border-brick text-brick hover:bg-brick hover:text-canvas"
                  }`}
                >
                  {item.retired ? "Restore" : "Retire"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
