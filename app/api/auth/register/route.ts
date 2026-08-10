import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { createSession, hashPassword, toPublicUser, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, password, organisation, phone } = body ?? {};

  if (!name || !email || !password || !organisation) {
    return NextResponse.json(
      { error: "Name, email, organisation and password are required." },
      { status: 400 }
    );
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  if (store.users.some((u) => u.email === normalisedEmail)) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const user = {
    id: randomUUID(),
    name: String(name).trim(),
    email: normalisedEmail,
    passwordHash: hashPassword(String(password)),
    organisation: String(organisation).trim(),
    phone: phone ? String(phone).trim() : "",
    role: "requester" as const,
  };
  store.users.push(user);

  const token = createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
