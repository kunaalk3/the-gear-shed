import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = store.items.find((i) => i.id === id && !i.retired);
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}
