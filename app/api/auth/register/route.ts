import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/data/queries";
import { createSessionToken, hashPassword, toPublicUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, password, organisation, phone, role } = body ?? {};
  const requestedRole: "requester" | "org" = role === "org" ? "org" : "requester";

  if (!name || !email || !password || !organisation) {
    return NextResponse.json(
      { error: "Name, email, organisation and password are required." },
      { status: 400 }
    );
  }

  const normalisedEmail = String(email).trim().toLowerCase();
  if (await getUserByEmail(normalisedEmail)) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const user = await createUser({
    id: randomUUID(),
    name: String(name).trim(),
    email: normalisedEmail,
    passwordHash: hashPassword(String(password)),
    organisation: String(organisation).trim(),
    phone: phone ? String(phone).trim() : "",
    role: requestedRole,
    orgStatus: requestedRole === "org" ? "pending" : "approved",
  });

  const token = createSessionToken(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
