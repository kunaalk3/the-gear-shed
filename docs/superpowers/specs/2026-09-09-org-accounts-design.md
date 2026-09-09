# Organisation accounts + admin approval

## Problem

Right now only two roles exist: `requester` (borrows equipment) and `admin`
(manages the full inventory). There's no way for a community group to list
its own equipment — all inventory is admin-entered. This adds a third role,
`org`, that lets an organisation register, get vetted by an admin, and then
list items into the shared inventory once approved.

## Data model

`db/schema.sql`:

- `users.role` check constraint extended: `('requester', 'admin', 'org')`.
- New column `users.org_status text not null default 'approved'`, check
  `org_status in ('pending', 'approved', 'rejected')`. Default `'approved'`
  means the column is inert for `requester`/`admin` rows — it only gates
  behaviour when `role = 'org'`. Org signups insert `'pending'`.
- New column `equipment_items.owner_id text references users(id)`, nullable.
  `null` = original/admin-owned inventory. Set = created by that org account.
  Used to scope "my items" queries; no ownership means no other behavioural
  change to existing items.

`lib/types.ts`: `UserRole` becomes `"requester" | "admin" | "org"`; `User`
gains `orgStatus: "pending" | "approved" | "rejected"`; `EquipmentItem` gains
`ownerId: string | null`.

## Registration

`/register` gets a role toggle: "I'm borrowing equipment" (default) vs "I'm
registering an organisation." The existing `organisation` field is reused as
the org's name either way (already required). Submitting sends
`role: "requester" | "org"`.

`POST /api/auth/register` accepts an optional `role` field but only ever
honours `"requester"` or `"org"` — anything else (including `"admin"`) is
rejected/ignored server-side, so the public endpoint can never mint an admin.
When `role === "org"`, the created row gets `orgStatus: "pending"`. The user
is logged in immediately either way (matches current behaviour), so an org
applicant can see their pending status right away.

## Admin approval flow

Mirrors the existing loan-request approve/decline pattern exactly:

- `lib/data/queries.ts`: `getOrgAccounts(status?)`, `approveOrg(id)`,
  `rejectOrg(id)` — same shape as `getRequestsWithItemNames`,
  `approveRequest`, `declineRequest` (SQL `where org_status = 'pending'`
  guard on the update, returns `null` if already resolved).
- Routes: `app/api/admin/organisations/route.ts` (GET, list, admin-only),
  `app/api/admin/organisations/[id]/approve/route.ts`,
  `app/api/admin/organisations/[id]/reject/route.ts` — same auth guard
  (`requireAdmin`) and status-code shape (404 unknown id, 409 already
  resolved) as the existing request routes.
- `app/admin/organisations/page.tsx`: lists org accounts, pending first,
  same visual language as `/admin/requests`. Linked from `AdminNav`.
- `app/admin/page.tsx`: new "Pending organisations" `StatCard`, same
  pattern as the existing "Pending requests" card.

## Org-facing side

- `lib/auth.ts`: new `requireOrg()`, mirrors `requireAdmin()` — 401 if not
  logged in, 403 with a distinct message if `role !== 'org'`, and 403 with a
  "pending"/"rejected"-specific message if `org_status !== 'approved'`.
- `app/api/org/items/route.ts`: `GET` lists items where `owner_id` = the
  current user (via `requireOrg`); `POST` creates an item with `ownerId`
  forced to the current user's id, blocked (403) unless approved. Reuses
  `createItem`/`itemIdExists`/slugify logic from the admin items route —
  same validation (name, category, quantity ≥ 1, deposit ≥ 0).
- `app/org/items/page.tsx`: org dashboard. Shows a status banner when
  pending ("Your organisation is awaiting admin approval") or rejected
  ("Your organisation's application wasn't approved"); when approved, shows
  their own items plus an "Add item" button.
- `app/org/items/new/page.tsx`: item creation form, scoped fields only
  (no retired toggle — org accounts are create-only per the approved
  design, editing/retiring stays admin-only for all items including
  org-owned ones).
- `components/Header.tsx`: when `user.role === 'org'`, show an "Our items"
  link (same slot as "Admin" for admins / "My requests" for requesters).

## Explicitly out of scope (YAGNI)

- Org accounts editing or retiring their own items after creation (admin
  does this, same as today, for all items regardless of owner).
- Per-item approval queue — approval is at the org-account level only.
- Any change to the loan-request approval flow — requests for org-owned
  items still go through the existing admin approve/decline path
  unchanged.
