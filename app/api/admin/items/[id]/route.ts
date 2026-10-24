import { NextRequest, NextResponse } from "next/server";
import { getItemById, retireItem, updateItem } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import {
  CATEGORIES,
  isEquipmentCondition,
  isTransactionType,
  parseHireFee,
  parseNonNegativeInteger,
  type Category,
  type EquipmentItem,
} from "@/lib/types";

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
    transactionType,
    hireFee,
    condition,
    conditionNotes,
    depositRequired,
    bookingConditions,
    cancellationRules,
    pickupNotes,
    dropoffNotes,
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

  if (transactionType !== undefined) {
    if (!isTransactionType(transactionType)) {
      return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
    }
    patch.transactionType = transactionType;
  }

  if (condition !== undefined) {
    if (!isEquipmentCondition(condition)) {
      return NextResponse.json({ error: "Invalid equipment condition." }, { status: 400 });
    }
    patch.condition = condition;
  }

  if (conditionNotes !== undefined) patch.conditionNotes = String(conditionNotes).trim();

  if (hireFee !== undefined) {
    const fee = parseHireFee(hireFee);
    if (fee === null) {
      return NextResponse.json({ error: "Hire fee must be a non-negative whole-dollar amount." }, { status: 400 });
    }
    patch.hireFee = fee;
  }

  const resultingType = patch.transactionType ?? item.transactionType;
  const resultingFee = patch.hireFee ?? item.hireFee;
  if (resultingType !== "paid_hire" && resultingFee !== 0) {
    if (patch.transactionType && patch.transactionType !== item.transactionType && hireFee === undefined) {
      patch.hireFee = 0;
    } else {
      return NextResponse.json({ error: "Only paid-hire listings can have a hire fee." }, { status: 400 });
    }
  }

  if (images !== undefined) {
    const imageList = Array.isArray(images)
      ? images.filter((src): src is string => typeof src === "string" && src.trim().length > 0).slice(0, 3)
      : [];
    if (imageList.length) patch.images = imageList;
  }

  if (totalQuantity !== undefined) {
    const qty = parseNonNegativeInteger(totalQuantity);
    if (qty === null || qty < 1) {
      return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
    }
    patch.totalQuantity = qty;
  }

  if (depositRequired !== undefined) {
    const deposit = parseNonNegativeInteger(depositRequired);
    if (deposit === null) {
      return NextResponse.json({ error: "Deposit must be a non-negative whole-dollar amount." }, { status: 400 });
    }
    patch.depositRequired = deposit;
  }

  if (bookingConditions !== undefined) patch.bookingConditions = String(bookingConditions).trim();
  if (cancellationRules !== undefined) patch.cancellationRules = String(cancellationRules).trim();
  if (pickupNotes !== undefined) patch.pickupNotes = String(pickupNotes).trim();
  if (dropoffNotes !== undefined) patch.dropoffNotes = String(dropoffNotes).trim();
  if (retired !== undefined) patch.retired = Boolean(retired);

  const result = await updateItem(id, patch);
  if (result.quantityConflict) {
    return NextResponse.json(
      { error: "Quantity cannot be reduced below active reservations or checked-out equipment." },
      { status: 409 }
    );
  }
  if (!result.item) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  return NextResponse.json({ item: result.item });
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
