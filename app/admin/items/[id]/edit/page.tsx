"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import { FormField, FormTextarea } from "@/components/FormField";
import { ImagePicker } from "@/components/ImagePicker";
import { CATEGORIES, type Category, type EquipmentItem } from "@/lib/types";

interface Blackout {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export default function EditItemPage() {
  const { id } = useParams<{ id: string }>();
  const { ready } = useRequireUser({ role: "admin" });
  const router = useRouter();

  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [depositRequired, setDepositRequired] = useState(0);
  const [bookingConditions, setBookingConditions] = useState("");
  const [cancellationRules, setCancellationRules] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [blackoutStart, setBlackoutStart] = useState("");
  const [blackoutEnd, setBlackoutEnd] = useState("");
  const [blackoutReason, setBlackoutReason] = useState("");
  const [blackoutError, setBlackoutError] = useState<string | null>(null);
  const [blackoutBusy, setBlackoutBusy] = useState(false);

  const loadBlackouts = useCallback(() => {
    fetch(`/api/items/${id}/bookings`)
      .then((r) => r.json())
      .then((data) => setBlackouts(data.blackouts ?? []));
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    fetch("/api/admin/items")
      .then((r) => r.json())
      .then((data) => {
        const found = (data.items ?? []).find((i: EquipmentItem) => i.id === id);
        if (found) {
          setItem(found);
          setName(found.name);
          setCategory(found.category);
          setDescription(found.description);
          setTotalQuantity(found.totalQuantity);
          setDepositRequired(found.depositRequired);
          setBookingConditions(found.bookingConditions);
          setCancellationRules(found.cancellationRules);
          setImages(found.images);
        }
      })
      .finally(() => setLoading(false));
    loadBlackouts();
  }, [ready, id, loadBlackouts]);

  if (!ready || loading) return <Loading />;
  if (!item) return <p className="mx-auto max-w-md px-5 py-16 font-body text-ink/70">Item not found.</p>;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/admin/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        description,
        totalQuantity,
        depositRequired,
        bookingConditions,
        cancellationRules,
        images,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/admin/items");
  }

  async function addBlackout(event: FormEvent) {
    event.preventDefault();
    setBlackoutError(null);
    setBlackoutBusy(true);

    const res = await fetch(`/api/admin/items/${id}/blackouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: blackoutStart, endDate: blackoutEnd, reason: blackoutReason }),
    });
    const data = await res.json();
    setBlackoutBusy(false);

    if (!res.ok) {
      setBlackoutError(data.error ?? "Something went wrong.");
      return;
    }
    setBlackoutStart("");
    setBlackoutEnd("");
    setBlackoutReason("");
    loadBlackouts();
  }

  async function removeBlackout(blackoutId: string) {
    setBlackoutBusy(true);
    await fetch(`/api/admin/blackouts/${blackoutId}`, { method: "DELETE" });
    setBlackoutBusy(false);
    loadBlackouts();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Edit {item.name}</h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <FormField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />

        <label className="flex flex-col gap-1.5 font-body text-sm">
          <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <FormTextarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Quantity in the shed"
            type="number"
            min={1}
            required
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(Number(e.target.value))}
          />
          <FormField
            label="Deposit ($, 0 for none)"
            type="number"
            min={0}
            value={depositRequired}
            onChange={(e) => setDepositRequired(Number(e.target.value))}
          />
        </div>

        <FormTextarea
          label="Booking conditions"
          rows={2}
          value={bookingConditions}
          onChange={(e) => setBookingConditions(e.target.value)}
        />
        <FormTextarea
          label="Cancellation rules"
          rows={2}
          value={cancellationRules}
          onChange={(e) => setCancellationRules(e.target.value)}
        />
        <ImagePicker images={images} onChange={setImages} />

        {error && (
          <p role="alert" className="font-body text-sm text-brick">
            {error}
          </p>
        )}

        <button
          disabled={submitting}
          className="transition-standard mt-2 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="gear-tag mt-6 p-6">
        <h2 className="font-display text-xl font-bold text-pine">Scheduled unavailability</h2>
        <p className="mt-1 font-body text-sm text-ink/60">
          Block dates off for maintenance or anything else keeping this item out of circulation.
        </p>

        {blackouts.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {blackouts.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-dashed border-canvas-line px-3 py-2"
              >
                <div>
                  <p className="font-tag text-xs uppercase tracking-wide text-ink/70">
                    {b.startDate} → {b.endDate}
                  </p>
                  {b.reason && <p className="font-body text-sm text-ink/60">{b.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeBlackout(b.id)}
                  disabled={blackoutBusy}
                  className="font-tag text-xs uppercase tracking-wide text-brick hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addBlackout} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Start date"
              type="date"
              required
              value={blackoutStart}
              onChange={(e) => setBlackoutStart(e.target.value)}
            />
            <FormField
              label="End date"
              type="date"
              required
              value={blackoutEnd}
              onChange={(e) => setBlackoutEnd(e.target.value)}
            />
          </div>
          <FormField
            label="Reason (optional)"
            value={blackoutReason}
            onChange={(e) => setBlackoutReason(e.target.value)}
          />
          {blackoutError && (
            <p role="alert" className="font-body text-sm text-brick">
              {blackoutError}
            </p>
          )}
          <button
            disabled={blackoutBusy}
            className="transition-standard w-fit rounded-full border border-pine px-4 py-2 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas disabled:opacity-50"
          >
            Block these dates
          </button>
        </form>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
