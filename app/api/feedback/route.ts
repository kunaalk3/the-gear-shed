import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createFeedback } from "@/lib/data/queries";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { name, email, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and feedback are required." }, { status: 400 });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const trimmedMessage = String(message).trim();
  if (trimmedMessage.length < 5) {
    return NextResponse.json({ error: "Tell us a little more about your experience." }, { status: 400 });
  }

  const feedback = await createFeedback({
    id: randomUUID(),
    name: String(name).trim(),
    email: trimmedEmail,
    message: trimmedMessage,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ feedback }, { status: 201 });
}
