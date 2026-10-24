"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import { FormField, FormTextarea } from "@/components/FormField";
import { ImagePicker } from "@/components/ImagePicker";
import {
  CATEGORIES,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITIONS,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  type Category,
  type EquipmentCondition,
  type TransactionType,
} from "@/lib/types";

export default function NewItemPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("1");
  const [transactionType, setTransactionType] = useState<TransactionType>("temporary_free_loan");
  const [hireFee, setHireFee] = useState("0");
  const [condition, setCondition] = useState<EquipmentCondition>("unknown");
  const [conditionNotes, setConditionNotes] = useState("");
  const [depositRequired, setDepositRequired] = useState("0");
  const [bookingConditions, setBookingConditions] = useState("");
  const [cancellationRules, setCancellationRules] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) return <Loading />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        description,
        totalQuantity: Number(totalQuantity) || 1,
        transactionType,
        hireFee: transactionType === "paid_hire" ? Number(hireFee) || 0 : 0,
        condition,
        conditionNotes,
        depositRequired: Number(depositRequired) || 0,
        bookingConditions,
        cancellationRules,
        pickupNotes,
        dropoffNotes,
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

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Add an item</h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <FormField
          label="Name"
          required
          requiredMessage="Please enter this item's name."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <label className="flex flex-col gap-1.5 font-body text-sm">
          <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">Transaction type</span>
          <select
            value={transactionType}
            onChange={(e) => {
              const value = e.target.value as TransactionType;
              setTransactionType(value);
              if (value !== "paid_hire") setHireFee("0");
            }}
            className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
          >
            {TRANSACTION_TYPES.map((value) => (
              <option key={value} value={value}>{TRANSACTION_TYPE_LABELS[value]}</option>
            ))}
          </select>
        </label>

        {transactionType === "paid_hire" && (
          <FormField
            label="Hire fee ($, whole dollars)"
            type="number"
            min={0}
            step={1}
            value={hireFee}
            onChange={(e) => setHireFee(e.target.value)}
            onBlur={() => setHireFee((value) => (value.trim() === "" ? "0" : value))}
          />
        )}

        <label className="flex flex-col gap-1.5 font-body text-sm">
          <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">Physical condition</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
            className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine focus-visible:ring-2 focus-visible:ring-pine"
          >
            {EQUIPMENT_CONDITIONS.map((value) => (
              <option key={value} value={value}>{EQUIPMENT_CONDITION_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <FormTextarea
          label="Condition notes (optional)"
          rows={2}
          value={conditionNotes}
          onChange={(e) => setConditionNotes(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Quantity in the shed"
            type="number"
            min={1}
            required
            requiredMessage="Please enter how many you have."
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(e.target.value)}
            onBlur={() => setTotalQuantity((v) => (v.trim() === "" ? "1" : v))}
          />
          <FormField
            label="Deposit ($, 0 for none)"
            type="number"
            min={0}
            value={depositRequired}
            onChange={(e) => setDepositRequired(e.target.value)}
            onBlur={() => setDepositRequired((v) => (v.trim() === "" ? "0" : v))}
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Pickup preference"
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
          />
          <FormField
            label="Drop-off preference"
            value={dropoffNotes}
            onChange={(e) => setDropoffNotes(e.target.value)}
          />
        </div>
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
