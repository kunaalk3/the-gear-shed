import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { createSession, hashPassword, toPublicUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  const user = store.users.find((u) => u.email === normalisedEmail);
  if (!user || user.passwordHash !== hashPassword(String(password))) {
    return NextResponse.json(
      { error: "That email and password combination doesn't match our records." },
      { status: 401 }
    );
  }

  const token = createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
