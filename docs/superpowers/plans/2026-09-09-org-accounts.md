# Organisation Accounts + Admin Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a community organisation register an account, get vetted by an admin, and — once approved — list its own equipment into the shared inventory, alongside the existing admin-managed catalogue.

**Architecture:** Add a third `org` role to the existing `users` table (gated by a new `org_status` column) and an `owner_id` column on `equipment_items`. Reuse the codebase's existing loan-request approve/decline pattern for org approval, and its existing admin-item-creation pattern for org item creation, scoped by ownership.

**Tech Stack:** Next.js 16 App Router, Neon Postgres (`@neondatabase/serverless`), stateless signed-cookie auth (`lib/auth.ts`), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-09-org-accounts-design.md`

## Global Constraints

- Dates/timestamps stay ISO `text` columns — no `date`/`timestamptz` types (matches every existing table).
- The public registration endpoint must never be able to mint an `admin` role — only `requester` or `org`, regardless of what's posted.
- Every route that returns a `User`/org account to the client must strip `passwordHash` via `toPublicUser` — never return a raw DB row.
- Org accounts are **create-only**: they can add items, but editing/retiring any item (including their own) stays admin-only. No new UI or route should let an org account edit or retire an item.
- No new test framework — this project has none (`package.json` has no test runner) and verifies changes by running the real dev server against the real Neon DB with `curl`, matching how the existing backend migration in this repo was verified. Every task's "test" steps follow that convention.
- This is a solo-developer project with a single working tree — every task's dev-server steps assume `npm run dev` is available to start/stop on `localhost:3000`.

---

## Before You Start (any task)

Every task assumes a running dev server against the real database:

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3
curl -s localhost:3000/api/items | head -c 200
```

If the last command doesn't return JSON, check `/tmp/sharespace-dev.log`. Stop the server when a task's verification is done: `pkill -f "next dev"`.

The seeded accounts (from `scripts/seed.mjs`) are still the ones to log in as for testing:
- Admin: `admin@communityresourcenetwork.org.au` / `admin123`
- Requester: `sam.wilson@example.com` / `password123`

---

### Task 1: Database migration — org role, org_status, owner_id

**Files:**
- Modify: `db/schema.sql`
- Create: `scripts/migrate-org-accounts.mjs`

**Interfaces:**
- Produces: `users.org_status` column (`'pending' | 'approved' | 'rejected'`, default `'approved'`), `users.role` check now allows `'org'`, `equipment_items.owner_id` column (nullable, `references users(id)`). Every later task's SQL and TypeScript types depend on these existing in the live database.

- [ ] **Step 1: Update `db/schema.sql`**

Change the `users` table definition from:

```sql
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  organisation text not null default '',
  phone text not null default '',
  role text not null check (role in ('requester', 'admin'))
);
```

to:

```sql
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  organisation text not null default '',
  phone text not null default '',
  role text not null check (role in ('requester', 'admin', 'org')),
  org_status text not null default 'approved' check (org_status in ('pending', 'approved', 'rejected'))
);
```

And change the `equipment_items` table definition from:

```sql
create table if not exists equipment_items (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  images text[] not null default '{}',
  total_quantity integer not null,
  deposit_required integer not null default 0,
  booking_conditions text not null default '',
  cancellation_rules text not null default '',
  retired boolean not null default false
);
```

to:

```sql
create table if not exists equipment_items (
  id text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  images text[] not null default '{}',
  total_quantity integer not null,
  deposit_required integer not null default 0,
  booking_conditions text not null default '',
  cancellation_rules text not null default '',
  retired boolean not null default false,
  owner_id text references users(id)
);
```

This makes `apply-schema.mjs` produce the right shape on a brand-new database. It's a no-op against the already-existing production tables (`create table if not exists`), which is why Step 2 exists.

- [ ] **Step 2: Write the migration script for the existing production database**

Create `scripts/migrate-org-accounts.mjs`:

```javascript
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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}

const sql = neon(url);

await sql`alter table users add column if not exists org_status text not null default 'approved'`;

await sql`alter table users drop constraint if exists users_org_status_check`;
await sql`alter table users add constraint users_org_status_check check (org_status in ('pending', 'approved', 'rejected'))`;

await sql`alter table users drop constraint if exists users_role_check`;
await sql`alter table users add constraint users_role_check check (role in ('requester', 'admin', 'org'))`;

await sql`alter table equipment_items add column if not exists owner_id text references users(id)`;

const columns = await sql`
  select table_name, column_name, data_type
  from information_schema.columns
  where (table_name = 'users' and column_name = 'org_status')
     or (table_name = 'equipment_items' and column_name = 'owner_id')
  order by table_name
`;

console.log("Migration applied. New columns:");
for (const row of columns) {
  console.log(`  ${row.table_name}.${row.column_name} (${row.data_type})`);
}
```

- [ ] **Step 3: Run the migration against the real database**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
node scripts/migrate-org-accounts.mjs
```

Expected output:

```
Migration applied. New columns:
  equipment_items.owner_id (text)
  users.org_status (text)
```

- [ ] **Step 4: Verify the role check constraint accepts 'org'**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
node -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const fs = await import('fs');
  const env = fs.readFileSync('.env.local', 'utf8');
  const m = env.match(/DATABASE_URL=(.+)/);
  const sql = neon(m[1].trim());
  await sql\`insert into users (id, name, email, password_hash, organisation, phone, role, org_status) values ('migration-test-org', 'Test', 'migration-test@example.com', 'x', 'Test Org', '', 'org', 'pending')\`;
  const rows = await sql\`select role, org_status from users where id = 'migration-test-org'\`;
  console.log(rows);
  await sql\`delete from users where id = 'migration-test-org'\`;
  console.log('cleaned up');
});
"
```

Expected: prints `[ { role: 'org', org_status: 'pending' } ]` then `cleaned up`. If the insert throws a check-constraint error, the migration didn't apply — re-run Step 3 and check for errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
git add db/schema.sql scripts/migrate-org-accounts.mjs
git commit -m "$(cat <<'EOF'
Add org role, org_status, and item ownership to the schema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J5Tcqb1D8q9YzRvxwLVYj6
EOF
)"
```

---

### Task 2: Types + data layer for org accounts and item ownership

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/data/queries.ts`
- Modify: `lib/auth.ts`
- Modify: `app/api/auth/register/route.ts` (minimal — just keeps it compiling with the new required field; the real toggle logic is Task 3)
- Modify: `app/api/admin/items/route.ts` (minimal — same reason, for `createItem`'s new `ownerId` field)

**Interfaces:**
- Consumes: the `org_status`/`owner_id` columns from Task 1.
- Produces: `OrgStatus` type; `User.orgStatus`; `EquipmentItem.ownerId`; `requireOrg(): Promise<{ok:true,user:PublicUser}|{ok:false,status:401|403,error:string}>` in `lib/auth.ts`; `getOrgAccounts(status?: OrgStatus | null): Promise<User[]>`, `approveOrg(id): Promise<User|null>`, `rejectOrg(id): Promise<User|null>`, `getItemsForOwner(ownerId): Promise<EquipmentItem[]>` in `lib/data/queries.ts`. Later tasks call all of these by these exact names.

- [ ] **Step 1: Extend `lib/types.ts`**

Add a new exported type near `UserRole`:

```typescript
export type OrgStatus = "pending" | "approved" | "rejected";
```

Change `UserRole`:

```typescript
export type UserRole = "requester" | "admin" | "org";
```

Add `orgStatus` to the `User` interface (after `role`):

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  organisation: string;
  phone: string;
  role: UserRole;
  orgStatus: OrgStatus;
}
```

Add `ownerId` to the `EquipmentItem` interface (after `retired`):

```typescript
export interface EquipmentItem {
  id: string;
  name: string;
  category: Category;
  description: string;
  images: string[];
  totalQuantity: number;
  depositRequired: number;
  bookingConditions: string;
  cancellationRules: string;
  retired: boolean;
  ownerId: string | null;
}
```

- [ ] **Step 2: Update the mappers and existing queries in `lib/data/queries.ts`**

Update the import line at the top to include `OrgStatus`:

```typescript
import type {
  BlackoutPeriod,
  Booking,
  Category,
  EquipmentItem,
  LoanRequest,
  LoanRequestStatus,
  OrgStatus,
  User,
} from "@/lib/types";
```

In `mapItem`, add after the `retired` line:

```typescript
    retired: row.retired as boolean,
    ownerId: (row.owner_id as string | null) ?? null,
```

In `mapUser`, add after the `role` line:

```typescript
    role: row.role as User["role"],
    orgStatus: row.org_status as User["orgStatus"],
```

In `createItem`, change the insert to include `owner_id`:

```typescript
export async function createItem(item: EquipmentItem): Promise<EquipmentItem> {
  const rows = await sql`
    insert into equipment_items
      (id, name, category, description, images, total_quantity, deposit_required, booking_conditions, cancellation_rules, retired, owner_id)
    values
      (${item.id}, ${item.name}, ${item.category}, ${item.description}, ${item.images},
       ${item.totalQuantity}, ${item.depositRequired}, ${item.bookingConditions}, ${item.cancellationRules}, ${item.retired}, ${item.ownerId})
    returning *
  `;
  return mapItem(rows[0]);
}
```

In `createUser`, change the insert to include `org_status`:

```typescript
export async function createUser(user: User): Promise<User> {
  await sql`
    insert into users (id, name, email, password_hash, organisation, phone, role, org_status)
    values (${user.id}, ${user.name}, ${user.email}, ${user.passwordHash}, ${user.organisation}, ${user.phone}, ${user.role}, ${user.orgStatus})
  `;
  return user;
}
```

- [ ] **Step 3: Add the new org-account and org-item queries**

Add this new section to `lib/data/queries.ts`, directly after the `// ---- users ----` section (after `createUser`, before `// ---- bookings ----`):

```typescript
// ---- organisation accounts ----

export async function getOrgAccounts(status?: OrgStatus | null): Promise<User[]> {
  const rows = status
    ? await sql`select * from users where role = 'org' and org_status = ${status} order by name`
    : await sql`select * from users where role = 'org' order by name`;
  return rows.map(mapUser);
}

/** Marks a pending org account approved. Returns null if it wasn't pending. */
export async function approveOrg(id: string): Promise<User | null> {
  const rows = await sql`
    update users set org_status = 'approved'
    where id = ${id} and role = 'org' and org_status = 'pending'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** Marks a pending org account rejected. Returns null if it wasn't pending. */
export async function rejectOrg(id: string): Promise<User | null> {
  const rows = await sql`
    update users set org_status = 'rejected'
    where id = ${id} and role = 'org' and org_status = 'pending'
    returning *
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}
```

Add this to the `// ---- equipment items ----` section, directly after `getItemById`:

```typescript
export async function getItemsForOwner(ownerId: string): Promise<EquipmentItem[]> {
  const rows = await sql`select * from equipment_items where owner_id = ${ownerId} order by name`;
  return rows.map(mapItem);
}
```

- [ ] **Step 4: Add `requireOrg` to `lib/auth.ts`**

Add this after `requireAdmin`:

```typescript
type OrgCheck =
  | { ok: true; user: PublicUser }
  | { ok: false; status: 401 | 403; error: string };

export async function requireOrg(): Promise<OrgCheck> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "Log in to continue." };
  if (user.role !== "org") return { ok: false, status: 403, error: "Organisation access required." };
  if (user.orgStatus === "pending") {
    return { ok: false, status: 403, error: "Your organisation is still awaiting admin approval." };
  }
  if (user.orgStatus === "rejected") {
    return { ok: false, status: 403, error: "Your organisation's application wasn't approved." };
  }
  return { ok: true, user };
}
```

- [ ] **Step 5: Fix the two existing call sites so the project still compiles**

In `app/api/auth/register/route.ts`, the `createUser` call currently ends with `role: "requester" as const,`. Change it to also set `orgStatus`:

```typescript
    role: "requester" as const,
    orgStatus: "approved" as const,
```

In `app/api/admin/items/route.ts`, the `createItem` call currently ends with `retired: false,`. Change it to also set `ownerId`:

```typescript
    retired: false,
    ownerId: null,
```

- [ ] **Step 6: Verify it compiles**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npx tsc --noEmit
```

Expected: no output (no type errors).

- [ ] **Step 7: Verify against the real dev server**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3

# Log in as the seeded admin and confirm orgStatus now appears on /api/auth/me
curl -s -c /tmp/admin-cookies.txt -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@communityresourcenetwork.org.au","password":"admin123"}' | head -c 300
echo
curl -s -b /tmp/admin-cookies.txt localhost:3000/api/auth/me

# Confirm the public items list still works and now includes ownerId (null for existing items)
curl -s localhost:3000/api/items | head -c 400
```

Expected: the `/api/auth/me` response includes `"role":"admin","orgStatus":"approved"`; the `/api/items` response includes `"ownerId":null` on existing items; no 500 errors in `/tmp/sharespace-dev.log`.

```bash
pkill -f "next dev"
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
git add lib/types.ts lib/data/queries.ts lib/auth.ts app/api/auth/register/route.ts app/api/admin/items/route.ts
git commit -m "$(cat <<'EOF'
Add org account and item-ownership types, queries, and auth guard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J5Tcqb1D8q9YzRvxwLVYj6
EOF
)"
```

---

### Task 3: Registration — organisation signup

**Files:**
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/register/page.tsx`

**Interfaces:**
- Consumes: `createUser` (Task 2), `OrgStatus` type (Task 2).
- Produces: `POST /api/auth/register` now accepts an optional `role: "requester" | "org"` field in its JSON body (any other value, including `"admin"`, is treated as `"requester"`).

- [ ] **Step 1: Update `app/api/auth/register/route.ts`**

Replace the body-destructuring line and the `createUser` call. Current:

```typescript
  const { name, email, password, organisation, phone } = body ?? {};
```

becomes:

```typescript
  const { name, email, password, organisation, phone, role } = body ?? {};
  const requestedRole: "requester" | "org" = role === "org" ? "org" : "requester";
```

And the `createUser` call:

```typescript
  const user = await createUser({
    id: randomUUID(),
    name: String(name).trim(),
    email: normalisedEmail,
    passwordHash: hashPassword(String(password)),
    organisation: String(organisation).trim(),
    phone: phone ? String(phone).trim() : "",
    role: requestedRole,
    orgStatus: requestedRole === "org" ? "pending" : "approved",
  });
```

- [ ] **Step 2: Add the role toggle to `app/register/page.tsx`**

Add a `role` state near the top of `RegisterFormInner`, alongside the existing `useState` calls:

```typescript
  const [role, setRole] = useState<"requester" | "org">("requester");
```

Include it in the `fetch` body:

```typescript
      body: JSON.stringify({ name, organisation, email, phone, password, role }),
```

Add the toggle UI right above the `<form onSubmit={handleSubmit} ...>` line:

```tsx
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setRole("requester")}
          className={roleButton(role === "requester")}
        >
          I&rsquo;m borrowing equipment
        </button>
        <button
          type="button"
          onClick={() => setRole("org")}
          className={roleButton(role === "org")}
        >
          I&rsquo;m registering an organisation
        </button>
      </div>
```

Change the wrapping form's top margin from `mt-6` to `mt-4` (since the toggle now carries the `mt-6`):

```tsx
      <form onSubmit={handleSubmit} className="gear-tag mt-4 flex flex-col gap-4 p-6">
```

Update the "Group or organisation" field's label and add a hint when `role === "org"`:

```tsx
        <FormField
          label={role === "org" ? "Organisation name" : "Group or organisation"}
          type="text"
          autoComplete="organization"
          required
          hint={
            role === "org"
              ? "An admin will review and approve your organisation before you can list equipment."
              : undefined
          }
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
        />
```

Add the `roleButton` helper function at the bottom of the file, alongside the component:

```typescript
function roleButton(active: boolean) {
  return `transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
    active ? "border-pine bg-pine text-canvas" : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
  }`;
}
```

- [ ] **Step 3: Verify with curl against the real dev server**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3

# Register a new org account
curl -s -c /tmp/org-cookies.txt -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jamie Lee","email":"jamie.lee+org1@example.com","password":"testpass1","organisation":"Northside Scouts","phone":"","role":"org"}'
echo
curl -s -b /tmp/org-cookies.txt localhost:3000/api/auth/me

# Register a plain requester (no role field) — must default to requester/approved
curl -s -c /tmp/req-cookies.txt -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex Kim","email":"alex.kim+req1@example.com","password":"testpass1","organisation":"Alex Kim"}'
echo
curl -s -b /tmp/req-cookies.txt localhost:3000/api/auth/me

# Attempt to register as admin — must be rejected server-side
curl -s -c /tmp/fake-admin-cookies.txt -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Sneaky","email":"sneaky+admin1@example.com","password":"testpass1","organisation":"N/A","role":"admin"}'
echo
curl -s -b /tmp/fake-admin-cookies.txt localhost:3000/api/auth/me
```

Expected:
- First `/api/auth/me`: `"role":"org","orgStatus":"pending"`.
- Second `/api/auth/me`: `"role":"requester","orgStatus":"approved"`.
- Third `/api/auth/me`: `"role":"requester"` — NOT `"admin"` — proving the public endpoint can't mint an admin.

Keep `/tmp/org-cookies.txt` around — Task 4's verification approves this exact account.

```bash
pkill -f "next dev"
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
git add app/api/auth/register/route.ts app/register/page.tsx
git commit -m "$(cat <<'EOF'
Add organisation signup toggle to registration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J5Tcqb1D8q9YzRvxwLVYj6
EOF
)"
```

---

### Task 4: Admin approval — list, approve, reject org accounts

**Files:**
- Create: `app/api/admin/organisations/route.ts`
- Create: `app/api/admin/organisations/[id]/approve/route.ts`
- Create: `app/api/admin/organisations/[id]/reject/route.ts`
- Create: `app/admin/organisations/page.tsx`
- Modify: `components/AdminNav.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `getOrgAccounts`, `approveOrg`, `rejectOrg`, `getUserById` (`lib/data/queries.ts`), `requireAdmin`, `toPublicUser` (`lib/auth.ts`).
- Produces: `GET /api/admin/organisations?status=<pending|approved|rejected>` → `{ organisations: PublicUser[] }`; `POST /api/admin/organisations/:id/approve` and `/reject` → `{ organisation: PublicUser | null }`.

- [ ] **Step 1: `app/api/admin/organisations/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getOrgAccounts } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";
import type { OrgStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as OrgStatus | null;

  const organisations = await getOrgAccounts(status);
  return NextResponse.json({ organisations: organisations.map(toPublicUser) });
}
```

- [ ] **Step 2: `app/api/admin/organisations/[id]/approve/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { approveOrg, getUserById } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing || existing.role !== "org") {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }
  if (existing.orgStatus !== "pending") {
    return NextResponse.json({ error: "Only pending organisations can be approved." }, { status: 409 });
  }

  const updated = await approveOrg(id);
  return NextResponse.json({ organisation: updated ? toPublicUser(updated) : null });
}
```

- [ ] **Step 3: `app/api/admin/organisations/[id]/reject/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { rejectOrg, getUserById } from "@/lib/data/queries";
import { requireAdmin, toPublicUser } from "@/lib/auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const existing = await getUserById(id);
  if (!existing || existing.role !== "org") {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }
  if (existing.orgStatus !== "pending") {
    return NextResponse.json({ error: "Only pending organisations can be rejected." }, { status: 409 });
  }

  const updated = await rejectOrg(id);
  return NextResponse.json({ organisation: updated ? toPublicUser(updated) : null });
}
```

- [ ] **Step 4: `components/AdminNav.tsx`** — add the new link

Change the `LINKS` array to:

```typescript
const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/items", label: "Inventory" },
  { href: "/admin/organisations", label: "Organisations" },
];
```

- [ ] **Step 5: `app/admin/organisations/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRequireUser } from "@/lib/use-require-user";
import AdminNav from "@/components/AdminNav";
import type { OrgStatus, PublicUser } from "@/lib/types";

const TABS: { label: string; value: OrgStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

export default function AdminOrganisationsPage() {
  const { ready } = useRequireUser({ role: "admin" });
  const [organisations, setOrganisations] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrgStatus | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/organisations")
      .then((r) => r.json())
      .then((data) => setOrganisations(data.organisations ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function approve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/organisations/${id}/approve`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function reject(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/organisations/${id}/reject`, { method: "POST" });
    setBusyId(null);
    load();
  }

  if (!ready) return <Loading />;

  const visible = filter === "all" ? organisations : organisations.filter((o) => o.orgStatus === filter);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Organisations</h1>

      <div className="mt-6">
        <AdminNav />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button key={tab.value} type="button" onClick={() => setFilter(tab.value)} className={pill(filter === tab.value)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 font-body text-ink/60">No {filter === "all" ? "" : filter} organisations.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {visible.map((o) => (
            <div key={o.id} className="gear-tag p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg font-bold text-ink">{o.organisation}</p>
                  <p className="font-tag text-xs uppercase tracking-wide text-ink/60">
                    {o.name} · {o.email} {o.phone && `· ${o.phone}`}
                  </p>
                </div>
                <StatusBadge status={o.orgStatus} />
              </div>

              {o.orgStatus === "pending" && (
                <div className="mt-3 flex gap-2 border-t border-dashed border-canvas-line pt-3">
                  <button
                    type="button"
                    onClick={() => approve(o.id)}
                    disabled={busyId === o.id}
                    className="transition-standard rounded-full bg-moss px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reject(o.id)}
                    disabled={busyId === o.id}
                    className="transition-standard rounded-full border border-brick px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-brick hover:bg-brick hover:text-canvas disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function pill(active: boolean) {
  return `transition-standard rounded-full border px-4 py-1.5 font-tag text-xs uppercase tracking-wide ${
    active ? "border-pine bg-pine text-canvas" : "border-canvas-line text-ink/70 hover:border-pine hover:text-pine"
  }`;
}

function StatusBadge({ status }: { status: OrgStatus }) {
  const styles: Record<OrgStatus, string> = {
    pending: "bg-amber/20 text-amber-dark",
    approved: "bg-moss/20 text-moss",
    rejected: "bg-brick/20 text-brick",
  };
  return (
    <span className={`w-fit shrink-0 rounded-full px-3 py-1 font-tag text-xs uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
```

- [ ] **Step 6: Add a "Pending organisations" stat card to `app/admin/page.tsx`**

Add a new state and fetch. Change:

```typescript
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
```

to:

```typescript
  const [requests, setRequests] = useState<RequestWithItem[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [pendingOrgCount, setPendingOrgCount] = useState(0);
  const [loading, setLoading] = useState(true);
```

Change the `Promise.all` block:

```typescript
    Promise.all([
      fetch("/api/admin/requests").then((r) => r.json()),
      fetch("/api/admin/items").then((r) => r.json()),
      fetch("/api/admin/organisations?status=pending").then((r) => r.json()),
    ])
      .then(([reqData, itemData, orgData]) => {
        setRequests(reqData.requests ?? []);
        setItems(itemData.items ?? []);
        setPendingOrgCount((orgData.organisations ?? []).length);
      })
      .finally(() => setLoading(false));
```

Change the stat-card grid from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` and add the new card:

```tsx
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pending requests" value={pending.length} href="/admin/requests" />
            <StatCard
              label="Pickups in the next 7 days"
              value={upcomingPickups.length}
              href="/admin/requests"
            />
            <StatCard label="Active items in the shed" value={activeItemCount} href="/admin/items" />
            <StatCard label="Pending organisations" value={pendingOrgCount} href="/admin/organisations" />
          </div>
```

- [ ] **Step 7: Verify with curl against the real dev server**

This continues from Task 3's verification — reuse the `/tmp/org-cookies.txt` for the pending org account created there (`jamie.lee+org1@example.com`).

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3

# Re-login as admin (cookie files from a previous run may be stale)
curl -s -c /tmp/admin-cookies.txt -X POST localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@communityresourcenetwork.org.au","password":"admin123"}' > /dev/null

# List pending orgs — should include Northside Scouts
curl -s -b /tmp/admin-cookies.txt "localhost:3000/api/admin/organisations?status=pending"
echo

# Grab its id and approve it
ORG_ID=$(curl -s -b /tmp/admin-cookies.txt "localhost:3000/api/admin/organisations?status=pending" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  const o = JSON.parse(d).organisations.find(o=>o.email==='jamie.lee+org1@example.com');
  console.log(o.id);
});
")
echo "org id: $ORG_ID"
curl -s -b /tmp/admin-cookies.txt -X POST "localhost:3000/api/admin/organisations/$ORG_ID/approve"
echo

# Confirm it flipped to approved
curl -s -b /tmp/org-cookies.txt localhost:3000/api/auth/me

# Approving again should now 409
curl -s -b /tmp/admin-cookies.txt -X POST "localhost:3000/api/admin/organisations/$ORG_ID/approve"
```

Expected:
- Pending list includes `"organisation":"Northside Scouts","orgStatus":"pending"`.
- Approve call returns `{"organisation":{...,"orgStatus":"approved"}}`.
- `/api/auth/me` on the org's own session now shows `"orgStatus":"approved"`.
- Second approve attempt returns `{"error":"Only pending organisations can be approved."}` with a 409.

Register one more org account to test rejection (leave it registered — it's harmless seed data):

```bash
curl -s -c /tmp/org2-cookies.txt -X POST localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Nair","email":"priya.nair+org2@example.com","password":"testpass1","organisation":"Eastside Rotary","phone":"","role":"org"}' > /dev/null

ORG2_ID=$(curl -s -b /tmp/admin-cookies.txt "localhost:3000/api/admin/organisations?status=pending" | node -e "
let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
  const o = JSON.parse(d).organisations.find(o=>o.email==='priya.nair+org2@example.com');
  console.log(o.id);
});
")
curl -s -b /tmp/admin-cookies.txt -X POST "localhost:3000/api/admin/organisations/$ORG2_ID/reject"
echo
curl -s -b /tmp/org2-cookies.txt localhost:3000/api/auth/me
```

Expected: `/api/auth/me` shows `"orgStatus":"rejected"`.

```bash
pkill -f "next dev"
```

- [ ] **Step 8: Commit**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
git add app/api/admin/organisations app/admin/organisations components/AdminNav.tsx app/admin/page.tsx
git commit -m "$(cat <<'EOF'
Add admin approval flow for organisation accounts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J5Tcqb1D8q9YzRvxwLVYj6
EOF
)"
```

---

### Task 5: Org-facing item creation

**Files:**
- Modify: `app/api/uploads/route.ts`
- Create: `app/api/org/items/route.ts`
- Create: `app/org/items/page.tsx`
- Create: `app/org/items/new/page.tsx`
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: `requireOrg` (`lib/auth.ts`, Task 2), `getItemsForOwner`, `createItem`, `itemIdExists` (`lib/data/queries.ts`).
- Produces: `GET /api/org/items` → `{ items: EquipmentItem[] }` (only the caller's own); `POST /api/org/items` → `{ item: EquipmentItem }`, `ownerId` forced to the caller.

- [ ] **Step 1: Widen `app/api/uploads/route.ts` to accept approved org accounts**

The `ImagePicker` component (used by both admin's and now org's item-creation forms) posts here. Currently it's admin-only. Change:

```typescript
import { requireAdmin } from "@/lib/auth";
```

to:

```typescript
import { requireAdmin, requireOrg } from "@/lib/auth";
```

And change the auth check at the top of `POST`:

```typescript
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
```

to:

```typescript
  const admin = await requireAdmin();
  const auth = admin.ok ? admin : await requireOrg();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
```

- [ ] **Step 2: `app/api/org/items/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createItem, getItemsForOwner, itemIdExists } from "@/lib/data/queries";
import { requireOrg } from "@/lib/auth";
import { CATEGORIES, type Category } from "@/lib/types";

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
    ownerId: auth.user.id,
  });

  return NextResponse.json({ item }, { status: 201 });
}
```

- [ ] **Step 3: `app/org/items/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireUser } from "@/lib/use-require-user";
import type { EquipmentItem } from "@/lib/types";

export default function OrgItemsPage() {
  const { ready } = useRequireUser({ role: "org" });
  const { user } = useAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/org/items")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ready && user?.orgStatus === "approved") load();
    else setLoading(false);
  }, [ready, user, load]);

  if (!ready || !user) return <Loading />;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">{user.organisation}</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Our items</h1>

      {user.orgStatus === "pending" && (
        <p className="gear-tag mt-6 p-4 font-body text-sm text-ink/70">
          Your organisation is awaiting admin approval. You&rsquo;ll be able to list equipment once
          it&rsquo;s approved.
        </p>
      )}

      {user.orgStatus === "rejected" && (
        <p className="gear-tag mt-6 p-4 font-body text-sm text-brick">
          Your organisation&rsquo;s application wasn&rsquo;t approved. Contact Community Resource
          Network SA for details.
        </p>
      )}

      {user.orgStatus === "approved" && (
        <>
          <div className="mt-6 flex justify-end">
            <Link
              href="/org/items/new"
              className="transition-standard rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark"
            >
              + Add item
            </Link>
          </div>

          {loading ? (
            <p className="mt-8 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-8 font-body text-ink/60">You haven&rsquo;t listed any equipment yet.</p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="gear-tag p-4">
                  <p className="font-tag text-[0.65rem] uppercase tracking-widest text-pine/70">
                    {item.category}
                  </p>
                  <p className="font-display text-lg font-bold text-ink">{item.name}</p>
                  <p className="mt-1 font-tag text-xs text-ink/60">Qty {item.totalQuantity}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
```

- [ ] **Step 4: `app/org/items/new/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useRequireUser } from "@/lib/use-require-user";
import { FormField, FormTextarea } from "@/components/FormField";
import { ImagePicker } from "@/components/ImagePicker";
import { CATEGORIES, type Category } from "@/lib/types";

export default function NewOrgItemPage() {
  const { ready } = useRequireUser({ role: "org" });
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [depositRequired, setDepositRequired] = useState(0);
  const [bookingConditions, setBookingConditions] = useState("");
  const [cancellationRules, setCancellationRules] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) return <Loading />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/org/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        description,
        totalQuantity,
        depositRequired,
        bookingConditions,
        cancellationRules,
        images,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/org/items");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Our items</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Add an item</h1>

      <form onSubmit={handleSubmit} className="gear-tag mt-6 flex flex-col gap-4 p-6">
        <FormField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />

        <label className="flex flex-col gap-1.5 font-body text-sm">
          <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-lg border border-canvas-line bg-white/70 px-3.5 py-2.5 outline-none focus:border-pine"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <FormTextarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Quantity available"
            type="number"
            min={1}
            required
            value={totalQuantity}
            onChange={(e) => setTotalQuantity(Number(e.target.value))}
          />
          <FormField
            label="Deposit ($, 0 for none)"
            type="number"
            min={0}
            value={depositRequired}
            onChange={(e) => setDepositRequired(Number(e.target.value))}
          />
        </div>

        <FormTextarea
          label="Booking conditions"
          rows={2}
          value={bookingConditions}
          onChange={(e) => setBookingConditions(e.target.value)}
        />
        <FormTextarea
          label="Cancellation rules"
          rows={2}
          value={cancellationRules}
          onChange={(e) => setCancellationRules(e.target.value)}
        />
        <ImagePicker images={images} onChange={setImages} />

        {error && (
          <p role="alert" className="font-body text-sm text-brick">
            {error}
          </p>
        )}

        <button
          disabled={submitting}
          className="transition-standard mt-2 rounded-full bg-amber px-5 py-2.5 font-body font-semibold text-pine hover:bg-amber-dark disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add item"}
        </button>
      </form>
    </div>
  );
}

function Loading() {
  return (
    <p className="mx-auto max-w-md px-5 py-16 font-tag text-sm uppercase tracking-wide text-ink/50">Loading…</p>
  );
}
```

- [ ] **Step 5: `components/Header.tsx`** — add the "Our items" link for org users

Change:

```tsx
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-full border border-amber/60 px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-amber transition-standard hover:bg-amber hover:text-pine"
                >
                  Admin
                </Link>
              ) : (
                <Link href="/my-requests" className="hidden transition-standard hover:text-amber sm:inline">
                  My requests
                </Link>
              )}
```

to:

```tsx
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-full border border-amber/60 px-4 py-1.5 font-tag text-xs uppercase tracking-wide text-amber transition-standard hover:bg-amber hover:text-pine"
                >
                  Admin
                </Link>
              ) : user.role === "org" ? (
                <Link href="/org/items" className="hidden transition-standard hover:text-amber sm:inline">
                  Our items
                </Link>
              ) : (
                <Link href="/my-requests" className="hidden transition-standard hover:text-amber sm:inline">
                  My requests
                </Link>
              )}
```

- [ ] **Step 6: Verify with curl against the real dev server**

Reuses the approved org account from Task 4 (`jamie.lee+org1@example.com`, cookies in `/tmp/org-cookies.txt`) and the rejected one (`priya.nair+org2@example.com`, cookies in `/tmp/org2-cookies.txt`).

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3

# Approved org creates an item
curl -s -b /tmp/org-cookies.txt -X POST localhost:3000/api/org/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Scout Camping Stove","category":"Cooking Facilities","description":"2-burner","totalQuantity":3,"depositRequired":0,"bookingConditions":"","cancellationRules":"","images":[]}'
echo

# Their own item list should show exactly this one
curl -s -b /tmp/org-cookies.txt localhost:3000/api/org/items

# It should also be visible in the public catalogue
curl -s "localhost:3000/api/items?search=Camping+Stove"

# Rejected org must be blocked
curl -s -b /tmp/org2-cookies.txt -X POST localhost:3000/api/org/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Not Exist","category":"Cooking Facilities","totalQuantity":1}'
echo

# A plain requester must also be blocked
curl -s -b /tmp/req-cookies.txt -X POST localhost:3000/api/org/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Should Not Exist Either","category":"Cooking Facilities","totalQuantity":1}'
```

Expected:
- First POST: 201 with `"ownerId"` equal to Jamie's user id.
- `/api/org/items`: `{"items":[{...,"name":"Scout Camping Stove",...}]}`.
- Public search: finds "Scout Camping Stove".
- Rejected org: `{"error":"Your organisation's application wasn't approved."}`, 403.
- Plain requester: `{"error":"Organisation access required."}`, 403.

Also do a quick regression check that admin uploads still work:

```bash
curl -s -b /tmp/admin-cookies.txt localhost:3000/api/admin/items | head -c 200
```

Expected: still returns the admin item list without error.

```bash
pkill -f "next dev"
```

- [ ] **Step 7: Commit**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
git add app/api/uploads/route.ts app/api/org/items app/org/items components/Header.tsx
git commit -m "$(cat <<'EOF'
Let approved organisations list their own items

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01J5Tcqb1D8q9YzRvxwLVYj6
EOF
)"
```

---

### Task 6: End-to-end browser verification

No files are modified in this task — it's a final check that every piece from Tasks 1–5 works together through the real UI, not just via curl.

**Interfaces:** None — verification only.

- [ ] **Step 1: Start the dev server**

```bash
cd "/Users/kunaalravi/Desktop/Industry Research project"
npm run dev > /tmp/sharespace-dev.log 2>&1 &
sleep 3
```

- [ ] **Step 2: Walk through the flow in a browser**

Using the browser automation tools (or a manual walkthrough if unavailable), against `http://localhost:3000`:

1. Go to `/register`. Click "I'm registering an organisation." Fill in a new org (e.g. name "Riley Chen", organisation "Southside Makers", a unique email, a password) and submit.
2. Confirm you land on `/equipment` logged in, then navigate to "Our items" in the header — confirm it shows the "awaiting admin approval" banner and no "Add item" button.
3. Log out. Log in as `admin@communityresourcenetwork.org.au` / `admin123`. Go to `/admin/organisations`, confirm "Southside Makers" appears under Pending, and confirm the admin dashboard's "Pending organisations" stat card reflects it. Click Approve.
4. Log out. Log back in as the Southside Makers account. Go to "Our items" — confirm the banner is gone and "+ Add item" is visible. Click it, fill in the item form (including uploading a real image via the image picker), submit.
5. Confirm it redirects to "Our items" and the new item is listed there.
6. Go to `/equipment` (the public catalogue, logged out or as any user) and confirm the new item appears and its detail page loads correctly.

- [ ] **Step 3: Report and stop the server**

Note any visual or interaction issues found. If something is visibly broken (a clipped layout, a control that does nothing), fix it and re-verify that one thing — don't restart the whole walkthrough.

```bash
pkill -f "next dev"
```
