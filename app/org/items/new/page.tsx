"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireUser } from "@/lib/use-require-user";
import { FormField, FormTextarea } from "@/components/FormField";
import { ImagePicker } from "@/components/ImagePicker";
import { CATEGORIES, type Category } from "@/lib/types";

export default function NewOrgItemPage() {
  const { ready } = useRequireUser({ role: "org" });
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [depositRequired, setDepositRequired] = useState(0);
  const [bookingConditions, setBookingConditions] = useState("");
  const [cancellationRules, setCancellationRules] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready || !user) return <Loading />;

  if (user.orgStatus !== "approved") {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Our items</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-pine">Add an item</h1>

        {user.orgStatus === "pending" && (
          <p className="gear-tag mt-6 p-4 font-body text-sm text-ink/70">
            Your organisation is awaiting admin approval. You&rsquo;ll be able to list equipment once
            it&rsquo;s approved.
          </p>
        )}

        {user.orgStatus === "rejected" && (
          <p className="gear-tag mt-6 p-4 font-body text-sm text-brick">
            Your organisation&rsquo;s application wasn&rsquo;t approved. Contact Community Resource
            Network SA for details.
          </p>
        )}

        <Link
          href="/org/items"
          className="mt-6 inline-block font-body text-sm font-semibold text-pine underline"
        >
          Back to Our items
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/org/items", {
      method: "POST",
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
    router.push("/org/items");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Our items</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Add an item</h1>

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
            label="Quantity available"
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
          {submitting ? "Adding…" : "Add item"}
        </button>
      </form>
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
