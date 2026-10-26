"use client";

import { useState, type FormEvent } from "react";
import type { TransactionType } from "@/lib/types";
import type {
  BookingFulfillmentEventType,
  BookingFulfillmentStatus,
} from "@/lib/fulfillment";

const EVENT_LABELS: Record<BookingFulfillmentEventType, string> = {
  collection_confirmed: "Confirm collection",
  return_inspected: "Record return inspection",
  donation_handover_confirmed: "Complete donation handover",
};

const STATUS_LABELS: Record<BookingFulfillmentStatus, string> = {
  not_started: "Not started",
  collected: "Collected",
  returned: "Returned",
  donation_completed: "Donation completed",
  legacy_unknown: "Legacy fulfilment needs reconciliation",
};

function nextEvent(
  transactionType: TransactionType,
  status: BookingFulfillmentStatus
): BookingFulfillmentEventType | null {
  if (
    status === "not_started" &&
    (transactionType === "paid_hire" || transactionType === "temporary_free_loan")
  ) {
    return "collection_confirmed";
  }
  if (
    status === "collected" &&
    (transactionType === "paid_hire" || transactionType === "temporary_free_loan")
  ) {
    return "return_inspected";
  }
  if (status === "not_started" && transactionType === "permanent_donation") {
    return "donation_handover_confirmed";
  }
  return null;
}

export default function FulfillmentActions({
  bookingId,
  bookingStatus,
  transactionType,
  fulfillmentStatus,
  onChanged,
}: {
  bookingId: string;
  bookingStatus: "pending" | "approved" | "cancelled";
  transactionType: TransactionType;
  fulfillmentStatus: BookingFulfillmentStatus;
  onChanged: () => void;
}) {
  const [condition, setCondition] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const eventType = nextEvent(transactionType, fulfillmentStatus);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!eventType) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          condition,
          notes,
          evidenceRefs: evidenceText
            .split(/\r?\n/)
            .map((reference) => reference.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not save fulfilment.");
        return;
      }
      setNotes("");
      setEvidenceText("");
      onChanged();
    } catch {
      setError("Unable to save fulfilment. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 border-t border-dashed border-canvas-line pt-3">
      <p className="font-tag text-xs uppercase tracking-wide text-pine">
        Fulfilment: {STATUS_LABELS[fulfillmentStatus]}
      </p>
      {bookingStatus !== "approved" ? (
        <p className="mt-1 font-body text-sm text-ink/60">
          Fulfilment can only be recorded for an approved booking.
        </p>
      ) : eventType ? (
        <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="font-tag text-xs uppercase tracking-wide text-ink/70">
            Condition
            <select
              value={condition}
              onChange={(change) => setCondition(change.target.value)}
              className="mt-1 block w-full rounded-lg border border-canvas-line bg-white/70 px-3 py-2 font-body text-sm"
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="font-tag text-xs uppercase tracking-wide text-ink/70">
            Notes
            <textarea
              value={notes}
              onChange={(change) => setNotes(change.target.value)}
              maxLength={2000}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-canvas-line bg-white/70 px-3 py-2 font-body text-sm"
            />
          </label>
          <label className="font-tag text-xs uppercase tracking-wide text-ink/70 sm:col-span-2">
            Evidence links (one HTTPS link per line)
            <textarea
              value={evidenceText}
              onChange={(change) => setEvidenceText(change.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-canvas-line bg-white/70 px-3 py-2 font-body text-sm"
            />
          </label>
          {error && <p role="alert" className="font-body text-sm text-brick sm:col-span-2">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-full bg-moss px-4 py-2 font-tag text-xs uppercase tracking-wide text-canvas disabled:opacity-50"
          >
            {busy ? "Saving…" : EVENT_LABELS[eventType]}
          </button>
        </form>
      ) : null}
    </section>
  );
}
