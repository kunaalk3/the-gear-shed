"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField, FormTextarea } from "@/components/FormField";

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <div className="gear-tag p-6">
          <p className="font-tag text-xs uppercase tracking-widest text-moss">Thank you</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-pine">Feedback sent</h1>
          <p className="mt-3 font-body text-sm text-ink/70">
            Thanks for telling us about your experience — Community Resource Network SA
            reads every response.
          </p>
        </div>
        <Link href="/" className="mt-4 font-body text-sm font-semibold text-pine underline underline-offset-2">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">We&rsquo;re listening</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-pine">Share your feedback</h1>
      <p className="mt-2 font-body text-sm text-ink/70">
        Tell us how borrowing or hiring through ComRes went — good or bad.
      </p>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <FormField
          label="Your name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormTextarea
          label="Your feedback or experience"
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && (
          <p role="alert" className="font-body text-sm text-brick">
            {error}
          </p>
        )}
        <button
          disabled={submitting}
          className="transition-standard mt-2 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </div>
  );
}
