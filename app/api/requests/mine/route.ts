import { NextResponse } from "next/server";
import { getRequestsForUser } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const requests = await getRequestsForUser(user.id);
  return NextResponse.json({ requests });
}
