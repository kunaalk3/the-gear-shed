import { NextResponse } from "next/server";
import { getRequestById } from "@/lib/data/queries";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log in to continue." }, { status: 401 });

  const { id } = await params;
  const existing = await getRequestById(id);
  if (!existing) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "You can only manage payment for your own requests." }, { status: 403 });
  }
  if (existing.status !== "approved") {
    return NextResponse.json({ error: "Only approved requests need a payment method." }, { status: 409 });
  }
  if (existing.depositChargeStatus === "card_saved" || existing.depositChargeStatus === "charged") {
    return NextResponse.json({ error: "A card is already on file for this request." }, { status: 409 });
  }

  const existingCustomers = await stripe.customers.search({
    query: `metadata['comresUserId']:'${user.id}'`,
  });
  const customerId =
    existingCustomers.data[0]?.id ??
    (
      await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { comresUserId: user.id },
      })
    ).id;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    currency: "aud",
    allowed_payment_method_types: ["card"],
    success_url: `${origin}/my-requests?payment=saved`,
    cancel_url: `${origin}/my-requests?payment=cancelled`,
    metadata: { requestId: id },
  });

  return NextResponse.json({ url: session.url });
}
