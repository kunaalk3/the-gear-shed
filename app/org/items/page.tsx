"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireUser } from "@/lib/use-require-user";
import OrgNav from "@/components/OrgNav";
import type { EquipmentItem } from "@/lib/types";

const KNOWN_PAYMENT_METHODS = ["Cash on pickup", "Bank transfer", "EFTPOS on pickup", "Invoice on account"];

export default function OrgItemsPage() {
  const { ready } = useRequireUser({ role: "org" });
  const { user, setUser } = useAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [methods, setMethods] = useState<string[]>([]);
  const [otherMethod, setOtherMethod] = useState("");
  const [savingMethods, setSavingMethods] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/org/items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready && user?.orgStatus === "approved") load();
    else setLoading(false);
  }, [ready, user, load]);

  useEffect(() => {
    if (user) setMethods(user.acceptedPaymentMethods ?? []);
  }, [user]);

  if (!ready || !user) return <Loading />;

  function toggleMethod(method: string) {
    setMethods((list) => (list.includes(method) ? list.filter((m) => m !== method) : [...list, method]));
  }

  async function saveMethods() {
    const combined = otherMethod.trim() ? [...methods, otherMethod.trim()] : methods;
    setSavingMethods(true);
    const res = await fetch("/api/org/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methods: combined }),
    });
    const data = await res.json();
    setSavingMethods(false);
    if (res.ok && data.user) {
      setUser(data.user);
      setMethods(data.user.acceptedPaymentMethods ?? []);
      setOtherMethod("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">{user.organisation}</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Our items</h1>

      <div className="mt-6">
        <OrgNav />
      </div>

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

      {user.orgStatus === "approved" && (
        <>
          <div className="gear-tag mt-6 p-5">
            <h2 className="font-display text-lg font-bold text-pine">Accepted payment methods</h2>
            <p className="mt-1 font-body text-sm text-ink/60">
              Shown to requesters so they know how to settle any deposit with you directly.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {KNOWN_PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className={`transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
                    methods.includes(method)
                      ? "border-pine bg-pine text-canvas"
                      : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={otherMethod}
                onChange={(e) => setOtherMethod(e.target.value)}
                placeholder="Other method (optional)"
                className="flex-1 rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2 font-body text-sm outline-none focus:border-pine"
              />
              <button
                type="button"
                onClick={saveMethods}
                disabled={savingMethods}
                className="transition-standard w-fit rounded-full bg-amber px-5 py-2 font-body text-sm font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
              >
                {savingMethods ? "Saving…" : "Save methods"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Link
              href="/org/items/new"
              className="transition-standard rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark"
            >
              + Add item
            </Link>
          </div>

          {loading ? (
            <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-8 font-body text-ink/60">You haven&rsquo;t listed any equipment yet.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/org/items/${item.id}/edit`}
                  className={`gear-tag transition-standard block p-4 hover:-translate-y-0.5 ${
                    item.retired ? "opacity-60" : ""
                  }`}
                >
                  <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                    {item.category}
                    {item.retired ? " · Retired" : ""}
                  </p>
                  <p className="font-display text-lg font-bold text-ink">{item.name}</p>
                  <p className="mt-1 font-tag text-xs text-ink/60">Qty {item.totalQuantity}</p>
                  <p className="mt-2 font-tag text-[0.65rem] uppercase tracking-wide text-amber-dark">Edit →</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
