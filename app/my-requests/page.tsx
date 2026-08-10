"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import type { LoanRequest } from "@/lib/types";

type RequestWithItem = LoanRequest & { itemName: string };

const statusStyle: Record<string, string> = {
  pending: "bg-amber/20 text-amber-dark",
  approved: "bg-moss/20 text-moss",
  declined: "bg-brick/20 text-brick",
};

export default function MyRequestsPage() {
  const { ready } = useRequireUser();
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    fetch("/api/requests/mine")
      .then((res) => res.json())
      .then((data) => setRequests(data.requests ?? []))
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
          {requests.map((r) => (
            <div
              key={r.id}
              className="gear-tag flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
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
          ))}
        </div>
      )}
    </div>
  );
}
