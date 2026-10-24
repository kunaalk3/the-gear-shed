"use client";

import { useState } from "react";

export default function RequestCancellation({
  requestId,
  onCancelled,
}: {
  requestId: string;
  onCancelled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not cancel this request.");
        return;
      }
      setOpen(false);
      setReason("");
      onCancelled();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="transition-standard w-fit rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas"
      >
        Cancel request
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-lg border border-dashed border-canvas-line p-3">
      <label htmlFor={`cancel-reason-${requestId}`} className="font-tag text-xs uppercase tracking-wide text-ink/60">
        Cancellation reason (optional)
      </label>
      <textarea
        id={`cancel-reason-${requestId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={1000}
        rows={2}
        className="w-full rounded-lg border border-canvas-line bg-white/70 px-3 py-2 font-body text-sm outline-none focus:border-pine"
      />
      {error && <p role="alert" className="font-body text-sm text-brick">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="transition-standard rounded-full bg-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50"
        >
          Confirm cancellation
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={submitting}
          className="transition-standard rounded-full border border-canvas-line px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-ink/60 hover:border-pine disabled:opacity-50"
        >
          Keep request
        </button>
      </div>
    </div>
  );
}
