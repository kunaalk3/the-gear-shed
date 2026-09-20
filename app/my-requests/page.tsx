"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import type { LoanRequest } from "@/lib/types";

type RequestWithItem = LoanRequest & { itemName: string; reviewed: boolean };

const statusStyle: Record<string, string> = {
  pending: "bg-amber/20 text-amber-dark",
  approved: "bg-moss/20 text-moss",
  declined: "bg-brick/20 text-brick",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function MyRequestsPage() {
  const { ready } = useRequireUser();
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/requests/mine")
      .then((res) => res.json())
      .then((data) => setRequests(data.requests ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  function handleReviewed(requestId: string) {
    setReviewingId(null);
    setRequests((list) => list.map((r) => (r.id === requestId ? { ...r, reviewed: true } : r)));
  }

  if (!ready) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">
        Loading…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Your history</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">My requests</h1>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-8 font-body text-ink/60">
          You haven&apos;t requested anything yet.{" "}
          <Link href="/equipment" className="font-semibold text-pine underline underline-offset-2">
            Browse the shed
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {requests.map((r) => {
            const canReview = r.status === "approved" && r.endDate < today() && !r.reviewed;
            return (
              <div key={r.id} className="gear-tag flex flex-col gap-2 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-bold text-ink">{r.itemName}</p>
                    <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                      {r.startDate} → {r.endDate} · x{r.quantity}
                    </p>
                    {r.status === "declined" && r.adminNote && (
                      <p className="mt-1 font-body text-sm text-brick">Reason: {r.adminNote}</p>
                    )}
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 font-tag text-xs uppercase tracking-wide ${statusStyle[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.reviewed && (
                  <p className="font-tag text-xs uppercase tracking-wide text-moss">Review submitted — thank you</p>
                )}

                {canReview && reviewingId !== r.id && (
                  <button
                    type="button"
                    onClick={() => setReviewingId(r.id)}
                    className="transition-standard w-fit rounded-full border border-pine px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas"
                  >
                    Leave a review
                  </button>
                )}

                {canReview && reviewingId === r.id && (
                  <ReviewForm requestId={r.id} onDone={() => handleReviewed(r.id)} onCancel={() => setReviewingId(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewForm({
  requestId,
  onDone,
  onCancel,
}: {
  requestId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, rating, comment }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    onDone();
  }

  return (
    <div className="rounded-lg border border-dashed border-canvas-line p-3">
      <p className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/50">Your rating</p>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={`text-2xl leading-none transition-standard ${n <= rating ? "text-amber" : "text-canvas-line"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How did it go? (optional)"
        rows={2}
        className="mt-2 w-full rounded-lg border border-canvas-line bg-white/70 px-3 py-2 font-body text-sm outline-none focus:border-pine"
      />
      {error && (
        <p role="alert" className="mt-1 font-body text-sm text-brick">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="transition-standard rounded-full bg-amber px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Submit review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="transition-standard rounded-full border border-canvas-line px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-ink/60 hover:border-pine"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
