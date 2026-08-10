"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FormField } from "@/components/FormField";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const redirectTo = searchParams.get("redirect") || "/equipment";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setUser(data.user);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Welcome back</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-pine">Log in</h1>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-4 font-body text-sm text-ink/70">
        New here?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-pine underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
