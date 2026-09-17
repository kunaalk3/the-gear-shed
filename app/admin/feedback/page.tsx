"use client";

import { useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import type { Feedback } from "@/lib/types";

export default function AdminFeedbackPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    fetch("/api/admin/feedback")
      .then((r) => r.json())
      .then((data) => setFeedback(data.feedback ?? []))
      .finally(() => setLoading(false));
  }, [ready]);

  if (!ready) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">
        Loading…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Customer feedback</h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : feedback.length === 0 ? (
        <p className="mt-8 font-body text-ink/60">No feedback submitted yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {feedback.map((f) => (
            <div key={f.id} className="gear-tag p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="font-display text-lg font-bold text-ink">{f.name}</p>
                <p className="font-tag text-xs uppercase tracking-wide text-ink/50">
                  {new Date(f.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="font-tag text-xs text-ink/60">{f.email}</p>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink/80">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
