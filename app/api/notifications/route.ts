import { NextResponse } from "next/server";
import { getNotificationsForUser, getUnreadNotificationCount, markAllNotificationsRead } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    getNotificationsForUser(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  return NextResponse.json({ notifications, unread });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
