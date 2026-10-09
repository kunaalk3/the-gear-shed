# Stripe deposit payments — design

Status: approved by user, pending spec sign-off
Date: 2026-10-09

## Purpose

Today, `equipment_items.deposit_required` is a display-only number — nothing
ever actually collects it. This adds a real payment integration: when a
borrower's loan request is approved, they save a card via Stripe (no charge).
If an admin later flags the request as a "bad hire" (item damaged/lost — this
flag already exists and is currently a no-op), the admin can charge that
saved card for the item's deposit amount.

No money moves unless a bad hire is flagged. This is intentionally the
lightest-touch of the three models considered (vs. authorize-and-capture, or
charge-and-refund) — it avoids holding or moving a borrower's money for the
common case (item returned fine), at the cost of not guaranteeing the funds
are still available if a charge is needed later. That trade-off was chosen
deliberately by the user.

## Out of scope

- Rental/booking fees — deposits only.
- Partial charges (e.g. charging less than the full deposit) — v1 charges the
  full `depositRequired` amount, no partial-amount UI.
- Org or admin-side payouts — ComRes does not forward money to orgs; Stripe
  here is purely for capturing deposit liability from borrowers.
- Retrying a failed charge automatically — a failed charge just leaves the
  request's status visible to the admin; they can re-trigger manually.

## Data model

Add four columns to `loan_requests`:

```sql
alter table loan_requests
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists deposit_charge_status text not null default 'none'
    check (deposit_charge_status in ('none', 'card_saved', 'charged', 'failed')),
  add column if not exists deposit_charged_at text;
```

- `stripe_customer_id` / `stripe_payment_method_id` — null until the borrower
  completes the Stripe Checkout setup session; set by the webhook handler
  (never trusted from the client redirect alone).
- `deposit_charge_status` — drives all UI gating:
  - `none` — no card on file yet. Borrower sees "Add payment method".
  - `card_saved` — card on file, nothing charged. Admin sees "Charge deposit"
    enabled once `badHire` is also true.
  - `charged` — deposit successfully charged. Admin sees a static "Charged"
    badge; charge action disabled.
  - `failed` — charge attempt failed (card declined, etc). Admin sees
    "Charge deposit" re-enabled with a "last attempt failed" note.
- `deposit_charged_at` — ISO timestamp, set when `charged`.

`lib/types.ts`: extend `LoanRequest` with
`stripeCustomerId: string | null`, `stripePaymentMethodId: string | null`,
`depositChargeStatus: "none" | "card_saved" | "charged" | "failed"`,
`depositChargedAt: string | null`.

`lib/data/queries.ts`: `mapLoanRequest()` (or equivalent row mapper) picks up
the four new columns; two new query functions:
- `saveStripePaymentMethod(requestId, customerId, paymentMethodId)` — sets
  the two Stripe IDs and `deposit_charge_status = 'card_saved'`.
- `setDepositChargeResult(requestId, status, chargedAt)` — sets
  `deposit_charge_status` and `deposit_charged_at` after a charge attempt.

A migration script `scripts/add-stripe-columns.mjs` (same pattern as the
existing `scripts/add-terms-columns.mjs`) applies the `alter table` above to
production directly — non-destructive, `add column if not exists`.

## Components

### `lib/stripe.ts`

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "<pinned version>",
});
```

Single shared client. Throws at import time if `STRIPE_SECRET_KEY` is
missing — consistent with how `lib/data/queries.ts` already treats
`DATABASE_URL` as required, not optional-with-fallback.

### Borrower flow: `app/api/requests/[id]/setup-card/route.ts` (POST)

- Auth: requester must own the request (`loanRequest.userId === session.id`).
- Guards: request must be `status === "approved"`; `depositChargeStatus`
  must be `"none"` (idempotent — don't let someone create a second setup
  session once a card's already on file).
- Creates (or reuses) a Stripe `Customer` for the borrower (keyed by their
  ComRes user id in `customer.metadata.comresUserId`, looked up via
  `stripe.customers.search` before creating, to avoid duplicate customers
  across multiple requests from the same borrower).
- Creates a Stripe Checkout Session with `mode: "setup"`,
  `customer: <that customer id>`, `success_url` /
  `cancel_url` pointing back to the request's detail view on
  `/requests` (the borrower's "My requests" page), and
  `metadata: { requestId }` on the session so the webhook can find the
  request.
- Returns `{ url: session.url }`; the client redirects the browser there.

### Borrower UI: `app/requests/page.tsx` ("My requests")

For a request with `status === "approved"`:
- `depositChargeStatus === "none"` and `depositRequired > 0`: show an
  "Add payment method" button → POST to `setup-card`, redirect to the
  returned `url`.
- `depositChargeStatus === "card_saved"`: show "Card on file" (static,
  no amount shown — Stripe Checkout in setup mode never displays or
  touches an amount).
- `depositChargeStatus === "charged"`: show "Deposit charged" with
  `depositChargedAt`.
- `depositChargeStatus === "failed"`: show "Payment method issue — please
  add a new card" and re-show the "Add payment method" button (same
  setup-card endpoint; a fresh Checkout session overwrites the saved
  payment method on success).
- If `depositRequired === 0`, skip all of this — nothing to collect.

### Webhook: `app/api/stripe/webhook/route.ts` (POST)

- Verifies the signature with `stripe.webhooks.constructEvent(...)` using
  `STRIPE_WEBHOOK_SECRET` and the raw request body (Next.js route must read
  the body as text/buffer, not JSON-parsed, before verification).
- Handles `checkout.session.completed` where `session.mode === "setup"`:
  reads `session.metadata.requestId`, `session.customer`, and
  `session.setup_intent` → fetches the SetupIntent to get
  `payment_method` → calls `saveStripePaymentMethod(requestId, customerId,
  paymentMethodId)`.
- Ignores all other event types (returns 200 so Stripe doesn't retry).
- This route is the single source of truth for "card saved" — the
  success_url redirect is UX only, never writes state itself.

### Admin flow: `app/api/admin/requests/[id]/charge-deposit/route.ts` (POST)

- Auth: admin only.
- Guards: `depositChargeStatus === "card_saved"` or `"failed"` (re-chargeable
  states); `badHire === true` (must be flagged first — enforced server-side,
  not just hidden in the UI); `depositRequired > 0`.
- Creates a Stripe `PaymentIntent`:
  ```ts
  stripe.paymentIntents.create({
    amount: depositRequired * 100, // cents; ComRes stores whole-currency-unit ints
    currency: "zar", // ComRes is a South African platform — matches existing deposit display
    customer: stripeCustomerId,
    payment_method: stripePaymentMethodId,
    off_session: true,
    confirm: true,
  })
  ```
- On success (`status === "succeeded"`): `setDepositChargeResult(id,
  "charged", now)`, create a notification to the borrower
  (type: reuse pattern from `createNotification`, message e.g. "A deposit
  of R{amount} was charged for your {item} loan.").
- On failure (Stripe throws `StripeCardError` or similar, e.g.
  `authentication_required` / `card_declined`): `setDepositChargeResult(id,
  "failed", null)`, return the decline reason to the admin UI as an error
  message (not a notification to the borrower — this is an admin-facing
  retry loop, not something a borrower self-serves from the "My requests"
  list).

### Admin UI: `app/admin/requests/page.tsx`

Next to the existing "Flag as bad hire" button, add a "Charge deposit"
button:
- Hidden entirely if `depositRequired === 0`.
- Disabled with a tooltip/label "No card on file" if `depositChargeStatus
  === "none"`.
- Disabled with "Flag as bad hire first" if `badHire === false`.
- Enabled ("Charge deposit") if `badHire === true` and
  `depositChargeStatus` is `"card_saved"` or `"failed"`.
- Shows "Charged ✓" (static) if `depositChargeStatus === "charged"`.
- On click: POST to `charge-deposit`, show the result inline (success or
  the decline reason), reload the list.

## Currency

Existing `depositRequired` is a plain integer with no currency field
anywhere in the schema or UI — it's displayed as a bare number. Checking the
item detail/edit pages confirms no "R" or currency symbol is rendered
either. This spec assumes ZAR (South Africa, matching "Community Resource
Network SA") since that's the only locale signal in the codebase (org
addresses, phone format elsewhere). **This is an assumption, not confirmed
with the user** — flagged explicitly for the spec review step.

## Environment variables

- `STRIPE_SECRET_KEY` — already in `.env.local`.
- `STRIPE_PUBLISHABLE_KEY` — already in `.env.local`; actually unused by
  this design (Checkout redirect needs no client-side Stripe.js), kept for
  potential future Elements-based work.
- `STRIPE_WEBHOOK_SECRET` — not yet set. For local dev, obtained by running
  `stripe listen --forward-to localhost:3000/api/stripe/webhook` (Stripe
  CLI). For production, created when registering the webhook endpoint in
  the Stripe dashboard (test mode) pointed at
  `https://community-sharespace-sa.vercel.app/api/stripe/webhook`, then set
  as a Vercel env var — this one touches shared/production config, so it
  will be called out explicitly before being set, not done silently as
  part of a routine push.

## Testing

- Stripe test-mode card numbers (`4242 4242 4242 4242` success,
  `4000 0000 0000 0002` decline) drive the Checkout setup flow and the
  charge-deposit flow end to end, the same way the existing E2E suite used
  curl + a throwaway account.
- Webhook delivery tested locally via `stripe trigger checkout.session.completed`
  or the Stripe CLI's `listen --forward-to`, not by faking the DB row
  directly (consistent with this session's established rule against
  raw DB mutation to fake state).
- All test data (Stripe customers, loan requests) cleaned up afterward via
  the existing cascade-delete script pattern; Stripe test-mode customers
  can be deleted via the dashboard or left — they cost nothing and carry no
  real data.

## Open questions for spec review

1. **Currency = ZAR?** Assumed above; no currency field exists today to
   confirm against.
2. **Notification to borrower on card save?** Not currently planned
   (silent success, just the UI state change) — add one?
