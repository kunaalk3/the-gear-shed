"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

/** Redirects to login (or home, if logged in with the wrong role) until the required user/role is present. */
export function useRequireUser(options?: { role?: UserRole; redirectTo?: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const requiredRole = options?.role;
  const redirectTo = options?.redirectTo;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const target = redirectTo ?? window.location.pathname;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace("/");
    }
  }, [loading, user, requiredRole, redirectTo, router]);

  const ready = !loading && !!user && (!requiredRole || user.role === requiredRole);
  return { user, ready };
}
