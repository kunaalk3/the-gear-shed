import { NextRequest, NextResponse } from "next/server";
import { setAcceptedPaymentMethods } from "@/lib/data/queries";
import { requireOrg, toPublicUser } from "@/lib/auth";

const KNOWN_METHODS = ["Cash on pickup", "Bank transfer", "EFTPOS on pickup", "Invoice on account"];

export async function PATCH(request: NextRequest) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const methods = body?.methods;
  if (!Array.isArray(methods) || !methods.every((m) => typeof m === "string")) {
    return NextResponse.json({ error: "methods must be a list of strings." }, { status: 400 });
  }

  const cleaned = methods
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && m.length <= 60);

  const updated = await setAcceptedPaymentMethods(auth.user.id, cleaned);
  return NextResponse.json({ user: updated ? toPublicUser(updated) : null, knownMethods: KNOWN_METHODS });
}
