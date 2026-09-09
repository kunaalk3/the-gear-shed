"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireUser } from "@/lib/use-require-user";
import type { EquipmentItem } from "@/lib/types";

export default function OrgItemsPage() {
  const { ready } = useRequireUser({ role: "org" });
  const { user } = useAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/org/items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready && user?.orgStatus === "approved") load();
    else setLoading(false);
  }, [ready, user, load]);

  if (!ready || !user) return <Loading />;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">{user.organisation}</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Our items</h1>

      {user.orgStatus === "pending" && (
        <p className="gear-tag mt-6 p-4 font-body text-sm text-ink/70">
          Your organisation is awaiting admin approval. You&rsquo;ll be able to list equipment once
          it&rsquo;s approved.
        </p>
      )}

      {user.orgStatus === "rejected" && (
        <p className="gear-tag mt-6 p-4 font-body text-sm text-brick">
          Your organisation&rsquo;s application wasn&rsquo;t approved. Contact Community Resource
          Network SA for details.
        </p>
      )}

      {user.orgStatus === "approved" && (
        <>
          <div className="mt-6 flex justify-end">
            <Link
              href="/org/items/new"
              className="transition-standard rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark"
            >
              + Add item
            </Link>
          </div>

          {loading ? (
            <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-8 font-body text-ink/60">You haven&rsquo;t listed any equipment yet.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="gear-tag p-4">
                  <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                    {item.category}
                  </p>
                  <p className="font-display text-lg font-bold text-ink">{item.name}</p>
                  <p className="mt-1 font-tag text-xs text-ink/60">Qty {item.totalQuantity}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
