"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="bg-pine text-canvas">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold uppercase tracking-tight text-canvas">
            Community ShareSpace SA
          </span>
          <span className="hidden font-tag text-[0.65rem] uppercase tracking-widest text-canvas/60 sm:inline">
            Community Resource Network SA
          </span>
        </Link>

        <nav className="flex items-center gap-5 font-body text-sm">
          <Link href="/equipment" className="transition-standard hover:text-amber">
            Browse equipment
          </Link>
          <Link href="/#how-it-works" className="hidden transition-standard hover:text-amber sm:inline">
            How it works
          </Link>

          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-full border border-amber/60 px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-amber transition-standard hover:bg-amber hover:text-pine"
                >
                  Admin
                </Link>
              ) : (
                <Link href="/my-requests" className="hidden transition-standard hover:text-amber sm:inline">
                  My requests
                </Link>
              )}
              <span className="hidden font-tag text-xs uppercase tracking-wide text-canvas/70 md:inline">
                Hi, {user.name.split(" ")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-canvas/40 px-4 py-1.5 transition-standard hover:border-amber hover:text-amber"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="transition-standard hover:text-amber"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-amber px-4 py-1.5 font-semibold text-pine transition-standard hover:bg-amber-dark"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
