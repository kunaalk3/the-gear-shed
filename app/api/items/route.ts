import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/data/store";
import type { Category } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as Category | null;
  const search = searchParams.get("search")?.trim().toLowerCase();

  let items = store.items.filter((item) => !item.retired);
  if (category) {
    items = items.filter((item) => item.category === category);
  }
  if (search) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ items });
}
