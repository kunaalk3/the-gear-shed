import { NextRequest, NextResponse } from "next/server";
import { createItem, getItemsForOwner, itemIdExists } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import {
  CATEGORIES,
  isEquipmentCondition,
  isTransactionType,
  parseHireFee,
  parseNonNegativeInteger,
  type Category,
} from "@/lib/types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET() {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({ items: await getItemsForOwner(auth.user.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
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
  } = body ?? {};

  if (!name || !category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Name and a valid category are required." }, { status: 400 });
  }
  const listingType = transactionType === undefined ? "temporary_free_loan" : transactionType;
  if (!isTransactionType(listingType)) {
    return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
  }
  const equipmentCondition = condition === undefined ? "unknown" : condition;
  if (!isEquipmentCondition(equipmentCondition)) {
    return NextResponse.json({ error: "Invalid equipment condition." }, { status: 400 });
  }
  const fee = hireFee === undefined ? 0 : parseHireFee(hireFee);
  if (fee === null) {
    return NextResponse.json({ error: "Hire fee must be a non-negative whole-dollar amount." }, { status: 400 });
  }
  if (listingType !== "paid_hire" && fee !== 0) {
    return NextResponse.json({ error: "Only paid-hire listings can have a hire fee." }, { status: 400 });
  }
  const qty = parseNonNegativeInteger(totalQuantity);
  if (qty === null || qty < 1) {
    return NextResponse.json({ error: "Quantity must be at least 1." }, { status: 400 });
  }
  const deposit = depositRequired === undefined ? 0 : parseNonNegativeInteger(depositRequired);
  if (deposit === null) {
    return NextResponse.json({ error: "Deposit must be a non-negative whole-dollar amount." }, { status: 400 });
  }

  const baseSlug = slugify(String(name)) || "item";
  let id = baseSlug;
  let suffix = 1;
  while (await itemIdExists(id)) {
    suffix += 1;
    id = `${baseSlug}-${suffix}`;
  }

  const imageList: string[] = Array.isArray(images)
    ? images.filter((src): src is string => typeof src === "string" && src.trim().length > 0).slice(0, 3)
    : [];

  const item = await createItem({
    id,
    name: String(name).trim(),
    category: category as Category,
    description: description ? String(description).trim() : "",
    images: imageList.length ? imageList : [`https://picsum.photos/seed/${id}/640/480`],
    totalQuantity: qty,
    transactionType: listingType,
    hireFee: fee,
    condition: equipmentCondition,
    conditionNotes: conditionNotes ? String(conditionNotes).trim() : "",
    depositRequired: deposit,
    bookingConditions: bookingConditions ? String(bookingConditions).trim() : "",
    cancellationRules: cancellationRules ? String(cancellationRules).trim() : "",
    pickupNotes: pickupNotes ? String(pickupNotes).trim() : "",
    dropoffNotes: dropoffNotes ? String(dropoffNotes).trim() : "",
    retired: false,
    ownerId: auth.user.id,
  });

  return NextResponse.json({ item }, { status: 201 });
}
