import { NextResponse } from "next/server";
import { getRequestById, getItemById, setDepositChargeResult } from "@/lib/data/queries";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  if (!existing.badHire) {
    return NextResponse.json({ error: "Flag this request as a bad hire before charging the deposit." }, { status: 409 });
  }
  if (existing.depositChargeStatus !== "card_saved" && existing.depositChargeStatus !== "failed") {
    return NextResponse.json({ error: "No chargeable card on file for this request." }, { status: 409 });
  }
  if (!existing.stripeCustomerId || !existing.stripePaymentMethodId) {
    return NextResponse.json({ error: "No chargeable card on file for this request." }, { status: 409 });
  }

  const item = await getItemById(existing.itemId, { includeRetired: true });
  const depositAmount = item?.depositRequired ?? 0;
  if (depositAmount <= 0) {
    return NextResponse.json({ error: "This item has no deposit configured." }, { status: 409 });
  }

  try {
    await stripe.paymentIntents.create({
      amount: depositAmount * 100,
      currency: "aud",
      customer: existing.stripeCustomerId,
      payment_method: existing.stripePaymentMethodId,
      off_session: true,
      confirm: true,
    });

    const chargedAt = new Date().toISOString();
    const updated = await setDepositChargeResult(id, "charged", chargedAt);
    await notifyUser(
      existing.userId,
      "deposit_charged",
      `A deposit of $${depositAmount} was charged for your ${item?.name ?? "item"} loan.`,
      "/my-requests"
    );
    return NextResponse.json({ request: updated });
  } catch (err) {
    await setDepositChargeResult(id, "failed", null);
    const message =
      err instanceof Stripe.errors.StripeCardError
        ? err.message
        : "The charge failed. Check the card details and try again.";
    return NextResponse.json({ error: message }, { status: 402 });
  }
}
