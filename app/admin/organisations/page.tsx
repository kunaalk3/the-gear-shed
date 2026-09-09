"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import type { OrgStatus, PublicUser } from "@/lib/types";

const TABS: { label: string; value: OrgStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

export default function AdminOrganisationsPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const [organisations, setOrganisations] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrgStatus | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/organisations")
      .then((r) => r.json())
      .then((data) => setOrganisations(data.organisations ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function approve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/organisations/${id}/approve`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function reject(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/organisations/${id}/reject`, { method: "POST" });
    setBusyId(null);
    load();
  }

  if (!ready) return <Loading />;

  const visible = filter === "all" ? organisations : organisations.filter((o) => o.orgStatus === filter);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Organisations</h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button key={tab.value} type="button" onClick={() => setFilter(tab.value)} className={pill(filter === tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 font-body text-ink/60">No {filter === "all" ? "" : filter} organisations.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visible.map((o) => (
            <div key={o.id} className="gear-tag p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-bold text-ink">{o.organisation}</p>
                  <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                    {o.name} · {o.email} {o.phone && `· ${o.phone}`}
                  </p>
                </div>
                <StatusBadge status={o.orgStatus} />
              </div>

              {o.orgStatus === "pending" && (
                <div className="mt-3 flex gap-2 border-t border-dashed border-canvas-line pt-3">
                  <button
                    type="button"
                    onClick={() => approve(o.id)}
                    disabled={busyId === o.id}
                    className="transition-standard rounded-full bg-moss px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(o.id)}
                    disabled={busyId === o.id}
                    className="transition-standard rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pill(active: boolean) {
  return `transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
    active ? "border-pine bg-pine text-canvas" : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
  }`;
}

function StatusBadge({ status }: { status: OrgStatus }) {
  const styles: Record<OrgStatus, string> = {
    pending: "bg-amber/20 text-amber-dark",
    approved: "bg-moss/20 text-moss",
    rejected: "bg-brick/20 text-brick",
  };
  return (
    <span className={`w-fit shrink-0 rounded-full px-3 py-1 font-tag text-xs uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
