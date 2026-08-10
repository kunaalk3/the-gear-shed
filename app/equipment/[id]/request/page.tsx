"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { FormField, FormTextarea } from "@/components/FormField";
import type { EquipmentItem, LoanRequest } from "@/lib/types";

const today = new Date().toISOString().slice(0, 10);

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [itemLoading, setItemLoading] = useState(true);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<LoanRequest | null>(null);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((res) => res.json())
      .then((data) => setItem(data.item ?? null))
      .finally(() => setItemLoading(false));
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/equipment/${id}/request`)}`);
    }
  }, [authLoading, user, id, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id, startDate, endDate, quantity, notes }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setConfirmation(data.request);
  }

  if (authLoading || itemLoading) {
    return (
      <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">
        Loading…
      </p>
    );
  }

  if (!item) {
    return <p className="mx-auto max-w-md px-5 py-16 font-body text-ink/70">We couldn&apos;t find that item.</p>;
  }

  if (!user) return null; // redirecting to login

  if (confirmation) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <div className="gear-tag p-6">
          <p className="font-tag text-xs uppercase tracking-widest text-moss">Request sent</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-pine">{item.name}</h1>
          <dl className="mt-4 space-y-2 font-body text-sm text-ink/80">
            <Row label="Dates" value={`${confirmation.startDate} → ${confirmation.endDate}`} />
            <Row label="Quantity" value={`x${confirmation.quantity}`} />
            <Row label="Status" value="Pending review" />
          </dl>
          <p className="mt-4 font-body text-sm text-ink/60">
            Community Resource Network SA will review your request and get in touch at {user.email}.
          </p>
        </div>
        <Link
          href="/equipment"
          className="mt-4 font-body text-sm font-semibold text-pine underline underline-offset-2"
        >
          Browse more equipment
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 py-16">
      <Link
        href={`/equipment/${item.id}`}
        className="font-tag text-xs uppercase tracking-widest text-pine/70 transition-standard hover:text-pine"
      >
        ← Back to {item.name}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-pine">Request to loan</h1>
      <p className="mt-1 font-body text-sm text-ink/60">
        {item.name} · x{item.totalQuantity} in the shed
        {item.depositRequired > 0 ? ` · $${item.depositRequired} deposit` : ""}
      </p>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Start date"
            type="date"
            required
            min={today}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <FormField
            label="End date"
            type="date"
            required
            min={startDate || today}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <FormField
          label="Quantity"
          type="number"
          required
          min={1}
          max={item.totalQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <FormTextarea
          label="Notes for the organisers (optional)"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="rounded-lg bg-canvas-dark/60 p-3 font-body text-xs text-ink/60">
          Requesting as <strong>{user.name}</strong> · {user.organisation} · {user.email}
        </div>

        {error && (
          <p role="alert" className="font-body text-sm text-brick">
            {error}
          </p>
        )}

        <button
          disabled={submitting}
          className="transition-standard mt-2 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Sending request…" : "Send loan request"}
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-canvas-line pb-1.5">
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
