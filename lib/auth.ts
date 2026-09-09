import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getUserById } from "@/lib/data/queries";
import type { PublicUser, User } from "@/lib/types";

export const SESSION_COOKIE_NAME = "sharespace_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches the previous cookie maxAge

export { hashPassword } from "@/lib/password";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

/**
 * Stateless session token: base64url(payload).signature — no server-side session
 * table, so auth survives serverless cold starts instead of living in a Map.
 */
export function createSessionToken(userId: string): string {
  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string): { userId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof userId !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return { userId };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await getUserById(session.userId);
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

type OrgCheck =
  | { ok: true; user: PublicUser }
  | { ok: false; status: 401 | 403; error: string };

export async function requireOrg(): Promise<OrgCheck> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Log in to continue." };
  if (user.role !== "org") return { ok: false, status: 403, error: "Organisation access required." };
  if (user.orgStatus === "pending") {
    return { ok: false, status: 403, error: "Your organisation is still awaiting admin approval." };
  }
  if (user.orgStatus === "rejected") {
    return { ok: false, status: 403, error: "Your organisation's application wasn't approved." };
  }
  return { ok: true, user };
}
