"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import RequestCancellation from "@/components/RequestCancellation";
import RequestStatusHistory from "@/components/RequestStatusHistory";
import FulfillmentActions from "@/components/FulfillmentActions";
import type {
  BookingPayment,
  LoanRequestStatus,
  RequestStatusHistory as RequestStatusHistoryEntry,
} from "@/lib/types";

interface RequestWithItem {
  id: string;
  userId: string;
  itemName: string;
  itemDepositRequired: number;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  bookingId: string | null;
  bookingStatus: "pending" | "approved" | "cancelled" | null;
  fulfillmentStatus: "not_started" | "collected" | "returned" | "donation_completed" | "legacy_unknown" | null;
  transactionType: "paid_hire" | "temporary_free_loan" | "permanent_donation" | null;
  adminNote: string;
  badHire: boolean;
  ownerId: string | null;
  ownerOrganisation: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  createdAt: string;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  bookingPayments: BookingPayment[];
  statusHistory: RequestStatusHistoryEntry[];
}

const TABS: { label: string; value: LoanRequestStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

export default function AdminRequestsPage() {
  const { ready, user } = useRequireUser({ role: "admin" });
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [loadedUser, setLoadedUser] = useState<typeof user>();
  const [refreshing, setRefreshing] = useState(false);
  const loading = refreshing || (ready && loadedUser !== user);
  const [filter, setFilter] = useState<LoanRequestStatus | "all">("pending");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback((): Promise<RequestWithItem[]> => {
    return fetch("/api/admin/requests")
      .then((r) => r.json())
      .then((data) => data.requests ?? []);
  }, []);

  const load = useCallback(() => {
    setRefreshing(true);
    fetchRequests()
      .then(setRequests)
      .finally(() => {
        setLoadedUser(user);
        setRefreshing(false);
      });
  }, [fetchRequests, user]);

  useEffect(() => {
    if (!ready) return;

    let active = true;
    fetchRequests()
      .then((data) => {
        if (active) setRequests(data);
      })
      .finally(() => {
        if (active) setLoadedUser(user);
      });

    return () => {
      active = false;
    };
  }, [ready, user, fetchRequests]);

  async function approve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/approve`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function toggleBadHire(request: RequestWithItem) {
    setBusyId(request.id);
    await fetch(`/api/admin/requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badHire: !request.badHire }),
    });
    setBusyId(null);
    load();
  }

  async function refundPayment(request: RequestWithItem, paymentKind: BookingPayment["kind"]) {
    setBusyId(request.id);
    try {
      const response = await fetch(`/api/admin/requests/${request.id}/payments/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKind }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error ?? "Could not process the refund.");
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
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
                  <p className="mt-1 font-tag text-[0.65rem] uppercase tracking-wide text-pine/70">
                    {r.ownerId ? `Owned by ${r.ownerOrganisation}` : "Community Resource Network SA stock"}
                  </p>
                  <p className="mt-1 font-body text-sm text-ink/70">
                    {r.startDate} → {r.endDate} · x{r.quantity}
                  </p>
                  {r.notes && <p className="mt-1 font-body text-sm text-ink/60">&ldquo;{r.notes}&rdquo;</p>}
                  {r.status === "declined" && r.adminNote && (
                    <p className="mt-1 font-body text-sm text-brick">Declined: {r.adminNote}</p>
                  )}
                  <p className="mt-1 font-tag text-[0.65rem] uppercase tracking-wide text-ink/40">
                    {r.termsAccepted
                      ? `T&Cs ${r.termsVersion} accepted by ${r.userId} on ${new Date(r.createdAt).toLocaleString()}`
                      : "T&Cs not recorded"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={r.status} />
                  {r.badHire && (
                    <span className="w-fit rounded-full bg-brick px-3 py-1 font-tag text-xs uppercase tracking-wide text-canvas">
                      ⚑ Bad hire
                    </span>
                  )}
                </div>
              </div>

              <RequestStatusHistory events={r.statusHistory} />
              {r.bookingId && r.bookingStatus && r.fulfillmentStatus && r.transactionType && (
                <FulfillmentActions
                  bookingId={r.bookingId}
                  bookingStatus={r.bookingStatus}
                  fulfillmentStatus={r.fulfillmentStatus}
                  transactionType={r.transactionType}
                  onChanged={load}
                />
              )}
              {(r.status === "pending" || r.status === "approved") && (
                <div className="mt-3">
                  <RequestCancellation requestId={r.id} onCancelled={load} />
                </div>
              )}

              <div className="mt-3 border-t border-dashed border-canvas-line pt-3">
                <button
                  type="button"
                  onClick={() => toggleBadHire(r)}
                  disabled={busyId === r.id}
                  className={`transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide disabled:opacity-50 ${
                    r.badHire
                      ? "border-canvas-line text-ink/60 hover:border-pine hover:text-pine"
                      : "border-brick text-brick hover:bg-brick hover:text-canvas"
                  }`}
                >
                  {r.badHire ? "Clear bad hire flag" : "Flag as bad hire"}
                </button>
              </div>
              {r.bookingPayments?.length > 0 && (
                <div className="mt-3 border-t border-dashed border-canvas-line pt-3">
                  <p className="font-tag text-xs uppercase tracking-wide text-ink/60">Payments</p>
                  {r.bookingPayments.map((payment) => (
                    <div key={payment.id} className="mt-1 flex flex-wrap items-center gap-2 font-body text-sm">
                      <span>
                        {payment.kind === "hire_fee" ? "Hire fee" : "Deposit"}:
                        {" "}${(payment.amountCents / 100).toFixed(2)} · {paymentStatusLabel(payment.status)}
                      </span>
                      {((payment.kind === "deposit" && payment.status === "manual_review") ||
                        payment.status === "refund_failed" ||
                        (r.status === "cancelled" && payment.status === "succeeded") ||
                        payment.status === "refund_pending") && (
                          <button
                            type="button"
                            onClick={() => refundPayment(r, payment.kind)}
                            disabled={busyId === r.id}
                            className="rounded-full border border-pine px-3 py-1 font-tag text-[0.65rem] uppercase tracking-wide text-pine disabled:opacity-50"
                          >
                            {payment.status === "manual_review"
                              ? "Approve deposit refund"
                              : payment.status === "succeeded"
                                ? "Retry cancellation refund"
                                : "Retry refund"}
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              )}

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
    cancelled: "bg-ink/10 text-ink/60",
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
