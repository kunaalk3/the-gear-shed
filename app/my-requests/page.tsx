"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import RequestCancellation from "@/components/RequestCancellation";
import RequestStatusHistory from "@/components/RequestStatusHistory";
import RequestFulfillmentHistory from "@/components/RequestFulfillmentHistory";
import type { BookingFulfillmentHistoryEvent, BookingFulfillmentStatus } from "@/lib/fulfillment";
import { waitForPaymentSetupConfirmation } from "@/lib/payment-setup";
import { readMyRequestsResponse } from "@/lib/my-requests-response";
import { readSetupCardResponse } from "@/lib/setup-card-response";
import type {
  BookingPayment,
  LoanRequest,
  RequestStatusHistory as RequestStatusHistoryEntry,
} from "@/lib/types";

type RequestWithItem = LoanRequest & {
  itemName: string;
  itemDepositRequired: number;
  reviewed: boolean;
  bookingId: string | null;
  statusHistory: RequestStatusHistoryEntry[];
  fulfillmentStatus: BookingFulfillmentStatus | null;
  fulfillmentEvents: BookingFulfillmentHistoryEvent[];
  bookingPayments: BookingPayment[];
};

type PaymentNotice = {
  kind: "success" | "error" | "info";
  message: string;
};

const statusStyle: Record<string, string> = {
  pending: "bg-amber/20 text-amber-dark",
  approved: "bg-moss/20 text-moss",
  declined: "bg-brick/20 text-brick",
  cancelled: "bg-ink/10 text-ink/60",
};

const today = () => new Date().toISOString().slice(0, 10);

function paymentStatusLabel(status: BookingPayment["status"]): string {
  const labels: Record<BookingPayment["status"], string> = {
    awaiting_payment_method: "Awaiting payment method",
    pending: "Payment pending",
    processing: "Processing",
    succeeded: "Paid",
    failed: "Payment failed",
    refund_pending: "Refund processing",
    refunded: "Refunded",
    refund_failed: "Refund failed",
    manual_review: "Manual review required",
  };
  return labels[status];
}

export default function MyRequestsPage() {
  const { ready } = useRequireUser();
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice | null>(null);

  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  const fetchRequests = useCallback(async () => {
    const response = await fetch("/api/requests/mine", { cache: "no-store" });
    const result = await readMyRequestsResponse<RequestWithItem>(response);
    if (!result.ok) {
      setRequestsError(result.error);
      setLoading(false);
      return result;
    }

    setRequests(result.requests);
    setRequestsError(null);
    setLoading(false);
    return result;
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchRequests().catch((error: unknown) => {
      console.error("Unable to load requests.", error);
      setRequestsError(error instanceof Error
        ? error.message
        : "Could not load your requests. Please try again.");
    }).finally(() => setLoading(false));
  }, [fetchRequests]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const searchParams = new URLSearchParams(window.location.search);
    const payment = searchParams.get("payment");
    const requestId = searchParams.get("requestId");

    void Promise.resolve().then(() => {
      if (cancelled) return;

      if (payment === "cancelled") {
        setPaymentNotice({
          kind: "info",
          message: "Payment method setup was cancelled. No card was saved from this attempt.",
        });
      }

      if (payment === "saved") {
        if (!requestId) {
          setPaymentNotice({
            kind: "error",
            message: "Checkout returned without a request reference, so the saved card could not be confirmed.",
          });
        } else {
          setPaymentNotice({
            kind: "info",
            message: "Checking whether your payment method was saved…",
          });
          const wait = (milliseconds: number) =>
            new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
          void waitForPaymentSetupConfirmation(
            async () => {
              const result = await fetchRequests();
              if (!result.ok) return "unavailable";
              return result.requests.find((request) => request.id === requestId)?.depositChargeStatus
                ?? "not_found";
            },
            wait
          ).then((result) => {
            if (cancelled) return;
            if (result === "saved") {
              setPaymentNotice({
                kind: "success",
                message: "Payment method saved and confirmed.",
              });
            } else if (result === "failed") {
              setPaymentNotice({
                kind: "error",
                message: "The payment method was not saved. Please try adding your card again.",
              });
            } else if (result === "not_found") {
              setPaymentNotice({
                kind: "error",
                message: "The request could not be found, so the payment method was not confirmed.",
              });
            } else {
              setPaymentNotice({
                kind: "error",
                message: "Checkout returned, but the card is not confirmed on file yet. Refresh shortly; if this continues, the Stripe webhook may not be configured or delivered.",
              });
            }
          }).catch((error: unknown) => {
            if (cancelled) return;
            console.error("Unable to confirm saved payment method.", error);
            setPaymentNotice({
              kind: "error",
              message: "The card could not be confirmed on file. Please refresh your requests and try again if needed.",
            });
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
        }
      }

      if (payment !== "saved" || !requestId) {
        fetchRequests().catch((error: unknown) => {
          if (cancelled) return;
          console.error("Unable to load requests.", error);
          setRequestsError(error instanceof Error
            ? error.message
            : "Could not load your requests. Please try again.");
        }).finally(() => {
          if (!cancelled) setLoading(false);
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ready, fetchRequests]);

  function handleReviewed(requestId: string) {
    setReviewingId(null);
    setRequests((list) => list.map((r) => (r.id === requestId ? { ...r, reviewed: true } : r)));
  }

  async function startCardSetup(requestId: string) {
    setPaymentNotice(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/setup-card`, { method: "POST" });
      const result = await readSetupCardResponse(res);
      if (!result.ok) {
        setPaymentNotice({ kind: "error", message: result.error });
        return;
      }
      setRedirectUrl(result.url);
    } catch (error) {
      console.error("Unable to start payment setup.", error);
      setPaymentNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not start payment setup.",
      });
    }
  }

  async function retryPayment(requestId: string) {
    setPaymentNotice(null);
    try {
      const response = await fetch(`/api/requests/${requestId}/payments/retry`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not retry payment.");
      const refreshResult = await fetchRequests();
      if (!refreshResult.ok) return;
      setPaymentNotice({
        kind: data.paymentUnresolved ? "info" : "success",
        message: data.paymentUnresolved
          ? "Payment is still being confirmed. Do not retry again until its status updates."
          : "Payment status refreshed.",
      });
    } catch (error) {
      console.error("Unable to retry booking payment.", error);
      setPaymentNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not retry payment.",
      });
    }
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
      {paymentNotice && (
        <p
          role={paymentNotice.kind === "error" ? "alert" : "status"}
          className={`mt-4 font-tag text-sm uppercase tracking-wide ${
            paymentNotice.kind === "success"
              ? "text-moss"
              : paymentNotice.kind === "error"
                ? "text-brick"
                : "text-ink/70"
          }`}
        >
          {paymentNotice.message}
        </p>
      )}

      {requestsError && (
        <div role="alert" className="gear-tag mt-8 p-4 font-body text-sm text-brick">
          <p>{requestsError}</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="mt-3 rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {loading && requests.length === 0 ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : requests.length === 0 && !requestsError ? (
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
            const payments = r.bookingPayments ?? [];
            const awaitingPaymentMethod = payments.some((payment) => payment.status === "awaiting_payment_method");
            const failedPayment = payments.some((payment) => payment.status === "failed");
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
                    {payments.map((payment) => (
                      <p key={payment.id} className={`mt-2 font-tag text-xs uppercase tracking-wide ${
                        payment.status === "succeeded" || payment.status === "refunded"
                          ? "text-moss"
                          : payment.status === "failed" || payment.status === "refund_failed" || payment.status === "manual_review"
                            ? "text-brick"
                            : "text-ink/60"
                      }`}>
                        {payment.kind === "hire_fee" ? "Hire fee" : "Deposit"}: {paymentStatusLabel(payment.status)}
                        {" · "}${(payment.amountCents / 100).toFixed(2)}
                      </p>
                    ))}
                    {r.status === "approved" && awaitingPaymentMethod && (
                      <>
                        <p className="mt-2 font-tag text-xs uppercase tracking-wide text-amber-dark">
                          Awaiting payment method
                        </p>
                        <button
                          type="button"
                          onClick={() => startCardSetup(r.id)}
                          className="transition-standard mt-1 w-fit rounded-full border border-pine px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas"
                        >
                          Add payment method
                        </button>
                      </>
                    )}
                    {r.status === "approved" && failedPayment && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => retryPayment(r.id)}
                          disabled={!r.stripePaymentMethodId}
                          className="transition-standard w-fit rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas disabled:opacity-40"
                        >
                          Retry payment
                        </button>
                        <button
                          type="button"
                          onClick={() => startCardSetup(r.id)}
                          className="transition-standard w-fit rounded-full border border-pine px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas"
                        >
                          Use a different card
                        </button>
                      </div>
                    )}
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 font-tag text-xs uppercase tracking-wide ${statusStyle[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>

                <RequestStatusHistory events={r.statusHistory} />
                {r.bookingId && r.fulfillmentStatus && (
                  <RequestFulfillmentHistory
                    status={r.fulfillmentStatus}
                    events={r.fulfillmentEvents}
                  />
                )}
                {(r.status === "pending" || r.status === "approved") && (
                  <RequestCancellation requestId={r.id} onCancelled={load} />
                )}

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
