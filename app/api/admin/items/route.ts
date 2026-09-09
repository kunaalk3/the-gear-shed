import { NextRequest, NextResponse } from "next/server";
import { createItem, getAllItemsAdmin, itemIdExists } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { CATEGORIES, type Category } from "@/lib/types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({ items: await getAllItemsAdmin() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const {
    name,
    category,
    description,
    images,
    totalQuantity,
    depositRequired,
    bookingConditions,
    cancellationRules,
  } = body ?? {};

  if (!name || !category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Name and a valid category are required." }, { status: 400 });
  }
  const qty = Number(totalQuantity);
  if (!Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
  }
  const deposit = Number(depositRequired) || 0;
  if (deposit < 0) {
    return NextResponse.json({ error: "Deposit can't be negative." }, { status: 400 });
  }

  const baseSlug = slugify(String(name)) || "item";
  let id = baseSlug;
  let suffix = 1;
  while (await itemIdExists(id)) {
    suffix += 1;
    id = `${baseSlug}-${suffix}`;
  }

  const imageList: string[] = Array.isArray(images)
    ? images.filter((src): src is string => typeof src === "string" && src.trim().length > 0)
    : [];

  const item = await createItem({
    id,
    name: String(name).trim(),
    category: category as Category,
    description: description ? String(description).trim() : "",
    images: imageList.length ? imageList : [`https://picsum.photos/seed/${id}/640/480`],
    totalQuantity: qty,
    depositRequired: deposit,
    bookingConditions: bookingConditions ? String(bookingConditions).trim() : "",
    cancellationRules: cancellationRules ? String(cancellationRules).trim() : "",
    retired: false,
    ownerId: null,
  });

  return NextResponse.json({ item }, { status: 201 });
}
