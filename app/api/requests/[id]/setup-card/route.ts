import { NextResponse } from "next/server";
import { createSetupCardErrorResponse } from "@/lib/setup-card-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ getBookingPaymentsForRequest, getRequestById }, { getCurrentUser }] =
      await Promise.all([
        import("@/lib/data/queries"),
        import("@/lib/auth"),
      ]);

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
    const payments = await getBookingPaymentsForRequest(id);
    const needsNewPaymentMethod = payments.some((payment) => payment.status === "failed");
    if (existing.stripePaymentMethodId && !needsNewPaymentMethod) {
      return NextResponse.json({ error: "A card is already on file for this request." }, { status: 409 });
    }

    const { assertStripeTestMode, stripe } = await import("@/lib/stripe");
    assertStripeTestMode();
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
      success_url: `${origin}/my-requests?payment=saved&requestId=${encodeURIComponent(id)}`,
      cancel_url: `${origin}/my-requests?payment=cancelled&requestId=${encodeURIComponent(id)}`,
      metadata: { requestId: id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to start card setup.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    const failure = createSetupCardErrorResponse(error);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
