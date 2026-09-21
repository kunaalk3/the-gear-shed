"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FormField } from "@/components/FormField";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const redirectTo = searchParams.get("redirect") || "/equipment";

  const [name, setName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"requester" | "org">("requester");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    if (!termsAccepted) {
      setError("You must agree to the Terms & Conditions and Privacy Policy to create an account.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, organisation, email, phone, password, role, termsAccepted }),
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
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Join the network</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-pine">Create an account</h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setRole("requester")}
          className={roleButton(role === "requester")}
        >
          I&rsquo;m borrowing or hiring equipment
        </button>
        <button
          type="button"
          onClick={() => setRole("org")}
          className={roleButton(role === "org")}
        >
          I&rsquo;m registering an organisation
        </button>
      </div>

      <form onSubmit={handleSubmit} className="gear-tag mt-4 flex flex-col gap-4 p-6">
        <FormField
          label="Your name"
          type="text"
          autoComplete="name"
          required
          requiredMessage="Please enter your name."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormField
          label={role === "org" ? "Organisation name" : "Group or organisation"}
          type="text"
          autoComplete="organization"
          required
          requiredMessage={
            role === "org" ? "Please enter your organisation's name." : "Please enter your group or organisation."
          }
          hint={
            role === "org"
              ? "An admin will review and approve your organisation before you can list equipment."
              : undefined
          }
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          required
          requiredMessage="Please enter your email address."
          invalidMessage="Please enter a valid email address, like name@example.com."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          requiredMessage="Please create a password."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          requiredMessage="Please confirm your password."
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="rounded-lg border border-canvas-line bg-white/50 p-3">
          <label className="flex items-start gap-2 font-body text-sm text-ink">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-canvas-line text-pine focus-visible:ring-2 focus-visible:ring-pine"
            />
            <span>
              I have read and agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-pine underline underline-offset-2"
              >
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-pine underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="font-body text-sm text-brick">
            {error}
          </p>
        )}
        <button
          disabled={submitting || !termsAccepted}
          className="transition-standard mt-2 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 font-body text-sm text-ink/70">
        Already registered?{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-pine underline underline-offset-2"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterFormInner />
    </Suspense>
  );
}

function roleButton(active: boolean) {
  return `transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
    active ? "border-pine bg-pine text-canvas" : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
  }`;
}
