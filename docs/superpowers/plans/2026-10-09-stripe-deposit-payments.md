# Stripe Deposit Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a borrower save a card (no charge) once their loan request is approved, and let an admin charge that saved card for the item's deposit once a request is flagged as a "bad hire."

**Architecture:** Stripe Checkout in `setup` mode collects the card (hosted page, no card data touches our server). A webhook is the only writer of "card saved" state (never trust the client redirect). A new admin-only route creates an off-session PaymentIntent against the saved payment method, gated on the existing `badHire` flag.

**Tech Stack:** Next.js 16 App Router, `stripe` npm SDK (server-side only, no Stripe.js/Elements needed), Neon Postgres via `@neondatabase/serverless`. This repo has no test runner (`package.json` has no `test` script, no jest/vitest, zero `*.test.*` files) — verification throughout this plan follows the project's established pattern instead: `tsc`/`next build`/`eslint`, plus manual `curl` smoke tests against `next dev` (the same pattern used for every other API route in this codebase, confirmed by inspecting `app/api/admin/requests/[id]/approve/route.ts` and its siblings).

**Spec:** `docs/superpowers/specs/2026-10-09-stripe-deposit-payments-design.md`

## Global Constraints

- Currency is `aud` on every Stripe amount (confirmed in spec).
- Card charges only happen off-session against a previously-saved payment method — never collect raw card data in any ComRes-hosted form.
- The webhook handler is the only code path allowed to write `deposit_charge_status = 'card_saved'`. No other route may set that value.
- `charge-deposit` must re-check `badHire === true` server-side even though the UI also hides the button — mirrors this codebase's existing pattern of re-validating state server-side (e.g. `approveRequest` re-checks `status === 'pending'` under the `where` clause, not just in the UI).
- All new DB columns use `add column if not exists` — non-destructive, matches `scripts/add-terms-columns.mjs`.
- Do not commit `.env.local` or print full Stripe key values in commit messages or code comments.

---

### Task 1: Install Stripe SDK and shared client

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `lib/stripe.ts`

**Interfaces:**
- Produces: `stripe` — a configured `Stripe` instance, imported by every later task as `import { stripe } from "@/lib/stripe"`.

- [ ] **Step 1: Install the SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create the shared client**

`lib/stripe.ts`:

```ts
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(secretKey);
```

(No `apiVersion` pinned — the SDK defaults to the version it was built against, same simplicity as `lib/db.ts` not pinning a Postgres wire-protocol version.)

- [ ] **Step 3: Verify it loads**

```bash
NODE_OPTIONS="" node -e "require('dotenv').config({path:'.env.local'})" 2>/dev/null; \
NODE_OPTIONS="" node --input-type=module -e "
import 'dotenv/config';
" 2>&1 | head -5 || true
npx tsc --noEmit
```
Expected: `tsc` reports no new errors (it will fail on this check alone before Task 3 adds the real usage — the real check is that `lib/stripe.ts` itself type-checks and `stripe` resolves as a package). If `dotenv` isn't installed, skip the first two lines — the meaningful check is `npx tsc --noEmit` passing on `lib/stripe.ts`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/stripe.ts
git commit -m "Add Stripe SDK and shared client"
```

---

### Task 2: Database migration — Stripe columns on loan_requests

**Files:**
- Modify: `db/schema.sql`
- Create: `scripts/add-stripe-columns.mjs`

**Interfaces:**
- Produces: four new columns on `loan_requests` — `stripe_customer_id text`, `stripe_payment_method_id text`, `deposit_charge_status text` (default `'none'`, check constraint `'none'|'card_saved'|'charged'|'failed'`), `deposit_charged_at text`. Task 3's `mapRequest` reads these by exact name.

- [ ] **Step 1: Update the schema reference file**

In `db/schema.sql`, inside the `loan_requests` table definition, add after the existing `bad_hire` column:

```sql
  bad_hire boolean not null default false,
  stripe_customer_id text,
  stripe_payment_method_id text,
  deposit_charge_status text not null default 'none'
    check (deposit_charge_status in ('none', 'card_saved', 'charged', 'failed')),
  deposit_charged_at text
```

(i.e. replace the line `bad_hire boolean not null default false` — currently the last column before the closing `);` of that table — with the block above.)

- [ ] **Step 2: Write the migration script**

`scripts/add-stripe-columns.mjs` (same loader pattern as `scripts/add-terms-columns.mjs`):

```js
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

await sql`alter table loan_requests add column if not exists stripe_customer_id text`;
await sql`alter table loan_requests add column if not exists stripe_payment_method_id text`;
await sql`
  alter table loan_requests add column if not exists deposit_charge_status text not null default 'none'
`;
await sql`
  alter table loan_requests
    drop constraint if exists loan_requests_deposit_charge_status_check
`;
await sql`
  alter table loan_requests
    add constraint loan_requests_deposit_charge_status_check
    check (deposit_charge_status in ('none', 'card_saved', 'charged', 'failed'))
`;
await sql`alter table loan_requests add column if not exists deposit_charged_at text`;

const [{ count }] = await sql`select count(*)::int as count from loan_requests`;
console.log(`Migration applied. ${count} existing loan_requests backfilled with deposit_charge_status = 'none'.`);
```

- [ ] **Step 3: Run it against production**

```bash
NODE_OPTIONS="" node scripts/add-stripe-columns.mjs
```
Expected: prints `Migration applied. N existing loan_requests backfilled with deposit_charge_status = 'none'.`

- [ ] **Step 4: Verify the columns exist**

```bash
NODE_OPTIONS="" node -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const fs = await import('fs');
  const path = await import('path');
  const content = fs.readFileSync('.env.local', 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('\"') && v.endsWith('\"')) || (v.startsWith(\"'\") && v.endsWith(\"'\"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql\`select column_name from information_schema.columns where table_name = 'loan_requests' order by ordinal_position\`;
  console.log(rows.map(r => r.column_name).join(', '));
});
"
```
Expected output includes `stripe_customer_id, stripe_payment_method_id, deposit_charge_status, deposit_charged_at`.

- [ ] **Step 5: Delete the migration script and commit the schema change**

Keep the script in the repo (matches the existing convention — `scripts/add-terms-columns.mjs` and `scripts/watermark-existing-images.mjs` are both kept, not deleted, since they're one-time-but-rerunnable migrations). Commit both files:

```bash
git add db/schema.sql scripts/add-stripe-columns.mjs
git commit -m "Add Stripe columns to loan_requests"
```

---

### Task 3: Types and query layer

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/queries.ts`

**Interfaces:**
- Consumes: the four DB columns from Task 2.
- Produces: `LoanRequest` type gains `stripeCustomerId: string | null`, `stripePaymentMethodId: string | null`, `depositChargeStatus: "none" | "card_saved" | "charged" | "failed"`, `depositChargedAt: string | null`. New functions `saveStripePaymentMethod(requestId: string, customerId: string, paymentMethodId: string): Promise<LoanRequest | null>` and `setDepositChargeResult(requestId: string, status: "charged" | "failed", chargedAt: string | null): Promise<LoanRequest | null>`, both used by Tasks 6 and 7. `NotificationType` gains `"payment_method_saved"`, used by Task 6.

- [ ] **Step 1: Extend `LoanRequest` and `NotificationType` in `lib/types.ts`**

Change:
```ts
export interface LoanRequest {
  id: string;
  itemId: string;
  userId: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  requesterPhone: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  badHire: boolean;
}
```
to:
```ts
export type DepositChargeStatus = "none" | "card_saved" | "charged" | "failed";

export interface LoanRequest {
  id: string;
  itemId: string;
  userId: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  requesterPhone: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  badHire: boolean;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  depositChargeStatus: DepositChargeStatus;
  depositChargedAt: string | null;
}
```

And change:
```ts
export type NotificationType =
  | "new_request"
  | "request_approved"
  | "request_declined"
  | "org_approved"
  | "org_rejected"
  | "new_org_pending";
```
to:
```ts
export type NotificationType =
  | "new_request"
  | "request_approved"
  | "request_declined"
  | "org_approved"
  | "org_rejected"
  | "new_org_pending"
  | "payment_method_saved";
```

- [ ] **Step 2: Update `mapRequest` in `lib/data/queries.ts`**

Change the end of `mapRequest` (around line 92-96) from:
```ts
    termsAccepted: row.terms_accepted as boolean,
    termsVersion: row.terms_version as string,
    badHire: row.bad_hire as boolean,
  };
}
```
to:
```ts
    termsAccepted: row.terms_accepted as boolean,
    termsVersion: row.terms_version as string,
    badHire: row.bad_hire as boolean,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripePaymentMethodId: (row.stripe_payment_method_id as string | null) ?? null,
    depositChargeStatus: row.deposit_charge_status as LoanRequest["depositChargeStatus"],
    depositChargedAt: (row.deposit_charged_at as string | null) ?? null,
  };
}
```
(Add `LoanRequest` to the existing `import type { ... } from "@/lib/types"` block at the top of the file if not already imported as a type — check first; `LoanRequestStatus` is already imported, `LoanRequest` is used as a return type throughout so it's almost certainly already there.)

- [ ] **Step 3: Add the two new query functions**

Immediately after `setBadHire` (which ends around line 497) in `lib/data/queries.ts`, add:

```ts
/** Records a saved card against a request. Only the Stripe webhook handler should call this. */
export async function saveStripePaymentMethod(
  requestId: string,
  customerId: string,
  paymentMethodId: string
): Promise<LoanRequest | null> {
  const rows = await sql`
    update loan_requests
    set stripe_customer_id = ${customerId},
        stripe_payment_method_id = ${paymentMethodId},
        deposit_charge_status = 'card_saved'
    where id = ${requestId}
    returning *
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
}

/** Records the outcome of a deposit charge attempt. */
export async function setDepositChargeResult(
  requestId: string,
  status: "charged" | "failed",
  chargedAt: string | null
): Promise<LoanRequest | null> {
  const rows = await sql`
    update loan_requests
    set deposit_charge_status = ${status},
        deposit_charged_at = ${chargedAt}
    where id = ${requestId}
    returning *
  `;
  return rows[0] ? mapRequest(rows[0]) : null;
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/data/queries.ts
git commit -m "Add Stripe fields to LoanRequest and query helpers"
```

---

### Task 4: Borrower route — create Checkout setup session

**Files:**
- Create: `app/api/requests/[id]/setup-card/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 1), `getRequestById` (existing), `getCurrentUser` (existing, `lib/auth.ts`).
- Produces: `POST /api/requests/:id/setup-card` → `{ url: string }` on success. Consumed by Task 7's "My requests" UI.

- [ ] **Step 1: Write the route**

`app/api/requests/[id]/setup-card/route.ts`:

```ts
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
    allowed_payment_method_types: ["card"], // installed stripe v23 types no longer accept payment_method_types here
    success_url: `${origin}/my-requests?payment=saved`,
    cancel_url: `${origin}/my-requests?payment=cancelled`,
    metadata: { requestId: id },
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_SITE_URL` to `.env.local`**

```bash
echo 'NEXT_PUBLIC_SITE_URL=http://localhost:3000' >> .env.local
```
(Production will get `https://community-sharespace-sa.vercel.app` set as a Vercel env var in Task 9 — not committed, since `.env.local` isn't tracked by git.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test against dev server**

```bash
npm run dev &
sleep 3
# Using a known approved request id and that borrower's session cookie (same curl + cookie-file pattern used throughout this project's manual E2E testing)
curl -s -X POST http://localhost:3000/api/requests/<approved-request-id>/setup-card \
  -b /tmp/requester_cookies.txt | python3 -m json.tool
```
Expected: `{"url": "https://checkout.stripe.com/..."}`. Kill the dev server after (`kill %1`).

- [ ] **Step 5: Commit**

```bash
git add "app/api/requests/[id]/setup-card/route.ts" .env.local
git status
```
Note: `.env.local` is gitignored in this project (confirmed by its absence from every prior commit in this session) — `git status` here is just to double check it doesn't get staged; do not force-add it.

```bash
git add "app/api/requests/[id]/setup-card/route.ts"
git commit -m "Add borrower endpoint to start Stripe card setup"
```

---

### Task 5: Webhook handler

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 1), `saveStripePaymentMethod` (Task 3), `notifyUser` (existing, `lib/notify.ts`), `getRequestById` (existing).
- Produces: `POST /api/stripe/webhook` — Stripe-facing, not called by any ComRes UI code.

- [ ] **Step 1: Write the route**

`app/api/stripe/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { saveStripePaymentMethod, getRequestById } from "@/lib/data/queries";
import { notifyUser } from "@/lib/notify";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "setup" && session.metadata?.requestId) {
      const requestId = session.metadata.requestId;
      const customerId = session.customer as string;
      const setupIntentId = session.setup_intent as string;
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      const paymentMethodId = setupIntent.payment_method as string;

      await saveStripePaymentMethod(requestId, customerId, paymentMethodId);

      const existing = await getRequestById(requestId);
      if (existing) {
        await notifyUser(
          existing.userId,
          "payment_method_saved",
          "Your card is on file for your approved loan.",
          "/my-requests"
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Manual smoke test with the Stripe CLI**

```bash
# one-time, if not already installed
brew install stripe/stripe-cli/stripe 2>/dev/null || true
stripe login
```
In one terminal:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the printed `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET`, restart `npm run dev`, then in another terminal:
```bash
stripe trigger checkout.session.completed
```
Expected: dev server logs show a 200 response from `/api/stripe/webhook`; note the triggered event won't have ComRes's `metadata.requestId`, so it's expected to no-op past the `session.metadata?.requestId` check — this step is verifying signature validation succeeds and the route doesn't crash, not the full save path. The full save path is verified end-to-end in Task 9's production smoke test, after a real Checkout session (from Task 4) is completed with a real test card.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "Add Stripe webhook handler for card-setup completion"
```

---

### Task 6: Admin route — charge the saved card

**Files:**
- Create: `app/api/admin/requests/[id]/charge-deposit/route.ts`

**Interfaces:**
- Consumes: `stripe` (Task 1), `requireAdmin` (existing), `getRequestById`, `getItemById` (existing), `setDepositChargeResult` (Task 3), `notifyUser` (existing).
- Produces: `POST /api/admin/requests/:id/charge-deposit` → `{ request: LoanRequest }` on success, `{ error: string }` with 402 on a card decline. Consumed by Task 8's admin UI.

- [ ] **Step 1: Write the route**

`app/api/admin/requests/[id]/charge-deposit/route.ts`:

```ts
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
```

(This uses the `NotificationType` value `"deposit_charged"` — add it now in Step 2 if Task 3 didn't already include it.)

- [ ] **Step 2: Confirm `NotificationType` includes `"deposit_charged"`**

Task 3, Step 1 only added `"payment_method_saved"` to `NotificationType`. Add one more member in `lib/types.ts`:
```ts
export type NotificationType =
  | "new_request"
  | "request_approved"
  | "request_declined"
  | "org_approved"
  | "org_rejected"
  | "new_org_pending"
  | "payment_method_saved"
  | "deposit_charged";
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Requires a request that already has `deposit_charge_status = 'card_saved'` (from completing Task 4+5's flow with a real Stripe test card, e.g. `4242 4242 4242 4242`) and `bad_hire = true` (toggle via the existing admin UI or `PATCH /api/admin/requests/:id`).

```bash
curl -s -X POST http://localhost:3000/api/admin/requests/<request-id>/charge-deposit \
  -b /tmp/admin_cookies.txt | python3 -m json.tool
```
Expected: `{"request": {...,"depositChargeStatus":"charged",...}}`. Repeat with card `4000 0000 0000 0002` (always declines) on a different request to confirm the 402 path: expected `{"error":"Your card was declined."}` (or similar Stripe decline message) and `depositChargeStatus` flips to `"failed"`.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts "app/api/admin/requests/[id]/charge-deposit/route.ts"
git commit -m "Add admin endpoint to charge a saved deposit card"
```

---

### Task 7: Borrower UI — "My requests" payment method controls

**Files:**
- Modify: `app/my-requests/page.tsx`

**Interfaces:**
- Consumes: `POST /api/requests/:id/setup-card` (Task 4). `RequestWithItem` type in this file must read the new `LoanRequest` fields from Task 3 (it's `type RequestWithItem = LoanRequest & { ... }`, so it inherits them automatically — no type edit needed here).

- [ ] **Step 1: Add a handler and the per-row UI block**

In `app/my-requests/page.tsx`, add a new function near `handleReviewed`:

```ts
  async function startCardSetup(requestId: string) {
    const res = await fetch(`/api/requests/${requestId}/setup-card`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not start payment setup.");
      return;
    }
    window.location.href = data.url;
  }
```

Then, inside the `.map((r) => { ... })` block, immediately after the closing of the `{r.status === "declined" && r.adminNote && (...)}` block and before the closing `</div>` of that first flex column (i.e. right after the existing declined-note paragraph, still inside the `<div>` that holds `itemName`), add:

```tsx
                    {r.status === "approved" && r.depositChargeStatus === "none" && (
                      <button
                        type="button"
                        onClick={() => startCardSetup(r.id)}
                        className="transition-standard mt-2 w-fit rounded-full border border-pine px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas"
                      >
                        Add payment method
                      </button>
                    )}
                    {r.depositChargeStatus === "card_saved" && (
                      <p className="mt-2 font-tag text-xs uppercase tracking-wide text-moss">Card on file</p>
                    )}
                    {r.depositChargeStatus === "charged" && (
                      <p className="mt-2 font-tag text-xs uppercase tracking-wide text-brick">Deposit charged</p>
                    )}
                    {r.depositChargeStatus === "failed" && (
                      <div className="mt-2">
                        <p className="font-tag text-xs uppercase tracking-wide text-brick">Payment method issue</p>
                        <button
                          type="button"
                          onClick={() => startCardSetup(r.id)}
                          className="transition-standard mt-1 w-fit rounded-full border border-pine px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas"
                        >
                          Add a new card
                        </button>
                      </div>
                    )}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Manual verification in the browser**

```bash
npm run dev
```
Log in as a borrower with an approved request whose linked item has `depositRequired > 0`, visit `/my-requests`, click "Add payment method", complete Stripe Checkout with card `4242 4242 4242 4242`/any future expiry/any CVC, confirm redirect back to `/my-requests?payment=saved` and that the row now shows "Card on file" after a refresh (webhook needs `stripe listen` running locally per Task 5, Step 3, for this to actually flip — note that for a kill-after-use `npm run dev`).

- [ ] **Step 4: Commit**

```bash
git add app/my-requests/page.tsx
git commit -m "Add payment-method controls to My requests page"
```

---

### Task 8: Admin UI — "Charge deposit" button

**Files:**
- Modify: `app/admin/requests/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/requests/:id/charge-deposit` (Task 6).

- [ ] **Step 1: Extend the `RequestWithItem` interface**

In `app/admin/requests/page.tsx`, change the import line:
```ts
import type { LoanRequestStatus } from "@/lib/types";
```
to:
```ts
import type { DepositChargeStatus, LoanRequestStatus } from "@/lib/types";
```

Then change:
```ts
interface RequestWithItem {
  id: string;
  userId: string;
  itemName: string;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
  badHire: boolean;
  ownerId: string | null;
  ownerOrganisation: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  createdAt: string;
}
```
to (adding the four new fields and an `itemDepositRequired` field the admin list query doesn't currently select — see Step 2):
```ts
interface RequestWithItem {
  id: string;
  userId: string;
  itemName: string;
  itemDepositRequired: number;
  requesterName: string;
  requesterEmail: string;
  requesterOrganisation: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes: string;
  status: LoanRequestStatus;
  adminNote: string;
  badHire: boolean;
  ownerId: string | null;
  ownerOrganisation: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  createdAt: string;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  depositChargeStatus: DepositChargeStatus;
  depositChargedAt: string | null;
}
```

- [ ] **Step 2: Select the item's deposit amount in the backing query**

The admin page fetches from `getRequestsWithItemNames` (`lib/data/queries.ts`), whose SQL currently selects `coalesce(i.name, 'Unknown item') as item_name` but not the item's deposit. In `lib/data/queries.ts`, update both `select` statements inside `getRequestsWithItemNames` (the `status`-filtered and unfiltered branches) by adding `i.deposit_required as item_deposit_required` next to the existing `i.owner_id, o.organisation as owner_organisation`, e.g.:
```sql
select r.*, coalesce(i.name, 'Unknown item') as item_name, i.deposit_required as item_deposit_required, i.owner_id, o.organisation as owner_organisation
```
(both branches), and update `mapRequestWithItem` to include it:
```ts
function mapRequestWithItem(row: Row): RequestWithItemRow {
  return {
    ...mapRequest(row),
    itemName: row.item_name as string,
    itemDepositRequired: (row.item_deposit_required as number) ?? 0,
    ownerId: (row.owner_id as string | null) ?? null,
    ownerOrganisation: (row.owner_organisation as string | null) ?? null,
  };
}
```
and add `itemDepositRequired: number;` to the `RequestWithItemRow` type alias above it.

- [ ] **Step 3: Add the charge handler and button**

In `app/admin/requests/page.tsx`, add near `toggleBadHire`:
```ts
  async function chargeDeposit(request: RequestWithItem) {
    setBusyId(request.id);
    const res = await fetch(`/api/admin/requests/${request.id}/charge-deposit`, { method: "POST" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) {
      alert(data.error ?? "Could not charge the deposit.");
      return;
    }
    load();
  }
```

Then, in the JSX, right after the existing "Flag as bad hire" `<button>` (still inside the same `<div className="mt-3 border-t border-dashed border-canvas-line pt-3">`), add:
```tsx
                {r.itemDepositRequired > 0 && r.depositChargeStatus === "charged" && (
                  <span className="ml-2 font-tag text-xs uppercase tracking-wide text-brick">Charged ✓</span>
                )}
                {r.itemDepositRequired > 0 && r.depositChargeStatus !== "charged" && (
                  <button
                    type="button"
                    onClick={() => chargeDeposit(r)}
                    disabled={
                      busyId === r.id ||
                      !r.badHire ||
                      (r.depositChargeStatus !== "card_saved" && r.depositChargeStatus !== "failed")
                    }
                    title={
                      !r.badHire
                        ? "Flag as bad hire first"
                        : r.depositChargeStatus === "none"
                        ? "No card on file"
                        : undefined
                    }
                    className="transition-standard ml-2 rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas disabled:opacity-40"
                  >
                    Charge deposit
                  </button>
                )}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual verification in the browser**

```bash
npm run dev
```
As admin, visit `/admin/requests`, confirm: a request with no card shows "Charge deposit" disabled with tooltip "No card on file"; after a borrower completes card setup (Task 7) it shows disabled with "Flag as bad hire first"; after toggling "Flag as bad hire" it becomes clickable; clicking it with a test card succeeds and shows "Charged ✓".

- [ ] **Step 6: Commit**

```bash
git add app/admin/requests/page.tsx lib/data/queries.ts
git commit -m "Add Charge deposit control to admin requests page"
```

---

### Task 9: Production rollout

**Files:** none (deployment/configuration only)

**Interfaces:** none — this task wires already-committed code to live infrastructure.

- [ ] **Step 1: Confirm everything so far is pushed**

```bash
git status
git log --oneline -10
git push origin main
```

- [ ] **Step 2: Set production environment variables in Vercel**

This touches shared production config — confirm with the user before running, per this session's standing rule about changes to shared infrastructure. State exactly what will be set (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` once obtained in Step 3, `NEXT_PUBLIC_SITE_URL=https://community-sharespace-sa.vercel.app`) and get a yes before running:

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
```

- [ ] **Step 3: Register the production webhook endpoint**

In the Stripe dashboard (test mode, since this is a sandbox account) → Developers → Webhooks → Add endpoint:
- URL: `https://community-sharespace-sa.vercel.app/api/stripe/webhook`
- Event: `checkout.session.completed`

Copy the signing secret it generates, then:
```bash
vercel env add STRIPE_WEBHOOK_SECRET production
```

- [ ] **Step 4: Deploy**

```bash
vercel --prod
```
Expected: deployment succeeds; note the deployment URL/alias it confirms.

- [ ] **Step 5: Smoke test on production**

As a real borrower account with an approved request (deposit > 0), visit `https://community-sharespace-sa.vercel.app/my-requests`, click "Add payment method", complete Checkout with test card `4242 4242 4242 4242`. Confirm the row flips to "Card on file" (may take a few seconds for the webhook). As admin, flag that request as a bad hire, click "Charge deposit", confirm it flips to "Charged ✓".

- [ ] **Step 6: Clean up test data**

Use the established cascade-delete script pattern (`scripts/_qa_cleanup*.mjs`, written throwaway and deleted after use elsewhere in this project) to remove any test request/booking/notification created during this smoke test, consistent with how every previous live-production testing pass in this project was cleaned up. Do not leave test loan requests or notifications in production data.
