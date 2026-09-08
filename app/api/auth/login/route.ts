import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/data/queries";
import { createSessionToken, hashPassword, toPublicUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

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
  const user = await getUserByEmail(normalisedEmail);
  if (!user || user.passwordHash !== hashPassword(String(password))) {
    return NextResponse.json(
      { error: "That email and password combination doesn't match our records." },
      { status: 401 }
    );
  }

  const token = createSessionToken(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
