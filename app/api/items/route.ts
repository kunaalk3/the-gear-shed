import { NextRequest, NextResponse } from "next/server";
import { getItems } from "@/lib/data/queries";
import type { Category } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as Category | null;
  const search = searchParams.get("search")?.trim().toLowerCase() ?? null;

  const items = await getItems({ category, search });
  return NextResponse.json({ items });
}
