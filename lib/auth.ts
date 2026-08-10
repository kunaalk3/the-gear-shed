import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { store } from "@/lib/data/store";
import type { PublicUser, User } from "@/lib/types";

export const SESSION_COOKIE_NAME = "gearshare_session";

export { hashPassword } from "@/lib/password";

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export function createSession(userId: string): string {
  const token = randomUUID();
  store.sessions.set(token, userId);
  return token;
}

export function destroySession(token: string | undefined) {
  if (token) store.sessions.delete(token);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = store.sessions.get(token);
  if (!userId) return null;
  const user = store.users.find((u) => u.id === userId);
  return user ? toPublicUser(user) : null;
}

type AdminCheck =
  | { ok: true; user: PublicUser }
  | { ok: false; status: 401 | 403; error: string };

export async function requireAdmin(): Promise<AdminCheck> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Log in to continue." };
  if (user.role !== "admin") return { ok: false, status: 403, error: "Admin access required." };
  return { ok: true, user };
}
