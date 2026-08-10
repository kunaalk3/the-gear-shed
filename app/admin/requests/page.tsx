"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import type { LoanRequestStatus } from "@/lib/types";

interface RequestWithItem {
  id: string;
  itemName: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
}

const TABS: { label: string; value: LoanRequestStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
  { label: "All", value: "all" },
];

export default function AdminRequestsPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LoanRequestStatus | "all">("pending");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/requests")
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function approve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/approve`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function decline(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: declineNote }),
    });
    setBusyId(null);
    setDecliningId(null);
    setDeclineNote("");
    load();
  }

  if (!ready) return <Loading />;

  const visible = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Loan requests</h1>

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
        <p className="mt-8 font-body text-ink/60">No {filter === "all" ? "" : filter} requests.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visible.map((r) => (
            <div key={r.id} className="gear-tag p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-bold text-ink">{r.itemName}</p>
                  <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                    {r.requesterName} · {r.requesterOrganisation} · {r.requesterEmail}
                  </p>
                  <p className="mt-1 font-body text-sm text-ink/70">
                    {r.startDate} → {r.endDate} · x{r.quantity}
                  </p>
                  {r.notes && <p className="mt-1 font-body text-sm text-ink/60">&ldquo;{r.notes}&rdquo;</p>}
                  {r.status === "declined" && r.adminNote && (
                    <p className="mt-1 font-body text-sm text-brick">Declined: {r.adminNote}</p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>

              {r.status === "pending" && (
                <div className="mt-3 border-t border-dashed border-canvas-line pt-3">
                  {decliningId === r.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={declineNote}
                        onChange={(e) => setDeclineNote(e.target.value)}
                        placeholder="Reason (optional, shown to requester)"
                        className="flex-1 rounded-lg border border-canvas-line bg-white/70 px-3 py-1.5 font-body text-sm outline-none focus:border-pine"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => decline(r.id)}
                          disabled={busyId === r.id}
                          className="transition-standard rounded-full bg-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50"
                        >
                          Confirm decline
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDecliningId(null);
                            setDeclineNote("");
                          }}
                          className="transition-standard rounded-full border border-canvas-line px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-ink/60 hover:border-pine"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approve(r.id)}
                        disabled={busyId === r.id}
                        className="transition-standard rounded-full bg-moss px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecliningId(r.id)}
                        disabled={busyId === r.id}
                        className="transition-standard rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
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

function StatusBadge({ status }: { status: LoanRequestStatus }) {
  const styles: Record<LoanRequestStatus, string> = {
    pending: "bg-amber/20 text-amber-dark",
    approved: "bg-moss/20 text-moss",
    declined: "bg-brick/20 text-brick",
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
