import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const requests = store.requests
    .filter((r) => r.userId === user.id)
    .map((r) => {
      const item = store.items.find((i) => i.id === r.itemId);
      return { ...r, itemName: item?.name ?? "Unknown item" };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ requests });
}
