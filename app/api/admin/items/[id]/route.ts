import { NextRequest, NextResponse } from "next/server";
import { getItemById, retireItem, updateItem } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { CATEGORIES, type Category, type EquipmentItem } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const item = await getItemById(id, { includeRetired: true });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const {
    name,
    category,
    description,
    images,
    totalQuantity,
    depositRequired,
    bookingConditions,
    cancellationRules,
    retired,
  } = body;

  const patch: Partial<Omit<EquipmentItem, "id">> = {};

  if (name !== undefined) patch.name = String(name).trim();

  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    patch.category = category as Category;
  }

  if (description !== undefined) patch.description = String(description).trim();

  if (images !== undefined) {
    const imageList = Array.isArray(images)
      ? images.filter((src): src is string => typeof src === "string" && src.trim().length > 0)
      : [];
    if (imageList.length) patch.images = imageList;
  }

  if (totalQuantity !== undefined) {
    const qty = Number(totalQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
    }
    patch.totalQuantity = qty;
  }

  if (depositRequired !== undefined) {
    const deposit = Number(depositRequired);
    if (Number.isNaN(deposit) || deposit < 0) {
      return NextResponse.json({ error: "Deposit can't be negative." }, { status: 400 });
    }
    patch.depositRequired = deposit;
  }

  if (bookingConditions !== undefined) patch.bookingConditions = String(bookingConditions).trim();
  if (cancellationRules !== undefined) patch.cancellationRules = String(cancellationRules).trim();
  if (retired !== undefined) patch.retired = Boolean(retired);

  const updated = await updateItem(id, patch);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const item = await retireItem(id);
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  return NextResponse.json({ item });
}
