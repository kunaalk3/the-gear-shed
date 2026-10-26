import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json(
    { error: "Direct bad-hire deposit charges are no longer supported. Deposit payments are handled by the booking payment lifecycle." },
    { status: 410 }
  );
}
