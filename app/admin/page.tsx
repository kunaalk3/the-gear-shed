"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";

interface RequestWithItem {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  itemName: string;
  requesterName: string;
  quantity: number;
}

interface AdminItem {
  id: string;
  retired: boolean;
}

export default function AdminOverviewPage() {
  const { ready, user } = useRequireUser({ role: "admin" });
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    Promise.all([
      fetch("/api/admin/requests").then((r) => r.json()),
      fetch("/api/admin/items").then((r) => r.json()),
    ])
      .then(([reqData, itemData]) => {
        setRequests(reqData.requests ?? []);
        setItems(itemData.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">
        Loading…
      </p>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadIso = weekAhead.toISOString().slice(0, 10);
  const upcomingPickups = requests.filter(
    (r) => r.status === "approved" && r.startDate >= today && r.startDate <= weekAheadIso
  );
  const activeItemCount = items.filter((i) => !i.retired).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">
        Welcome back, {user?.name.split(" ")[0]}
      </h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard label="Pending requests" value={pending.length} href="/admin/requests" />
            <StatCard
              label="Pickups in the next 7 days"
              value={upcomingPickups.length}
              href="/admin/requests"
            />
            <StatCard label="Active items in the shed" value={activeItemCount} href="/admin/items" />
          </div>

          <div className="mt-10">
            <h2 className="font-display text-xl font-bold text-pine">Needs review</h2>
            {pending.length === 0 ? (
              <p className="mt-2 font-body text-sm text-ink/60">Nothing waiting on you right now.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {pending.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href="/admin/requests"
                    className="gear-tag transition-standard flex items-center justify-between p-3 hover:-translate-y-0.5"
                  >
                    <div>
                      <p className="font-display text-base font-bold text-ink">{r.itemName}</p>
                      <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                        {r.requesterName} · {r.startDate} → {r.endDate} · x{r.quantity}
                      </p>
                    </div>
                    <span className="font-tag text-xs uppercase tracking-wide text-amber-dark">
                      Review →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="gear-tag transition-standard p-5 hover:-translate-y-0.5">
      <p className="font-tag text-xs uppercase tracking-widest text-ink/50">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold text-pine">{value}</p>
    </Link>
  );
}
