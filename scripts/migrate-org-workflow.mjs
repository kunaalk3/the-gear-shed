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

// Terms & conditions audit trail
await sql`alter table loan_requests add column if not exists terms_version text not null default 'v1'`;

// Notifications, shared by admin, org and requester users
await sql`
  create table if not exists notifications (
    id text primary key,
    user_id text not null references users(id),
    type text not null,
    message text not null,
    link text not null default '',
    read boolean not null default false,
    created_at text not null
  )
`;
await sql`create index if not exists idx_notifications_user_id on notifications(user_id)`;

// Reviews, one per completed request
await sql`
  create table if not exists reviews (
    id text primary key,
    request_id text not null unique references loan_requests(id),
    item_id text not null references equipment_items(id),
    user_id text not null references users(id),
    rating integer not null check (rating between 1 and 5),
    comment text not null default '',
    created_at text not null
  )
`;
await sql`create index if not exists idx_reviews_item_id on reviews(item_id)`;

// Org accepted payment methods (display-only, not a payment gateway)
await sql`alter table users add column if not exists accepted_payment_methods text[] not null default '{}'`;

// Per-item pickup/drop-off preferences
await sql`alter table equipment_items add column if not exists pickup_notes text not null default ''`;
await sql`alter table equipment_items add column if not exists dropoff_notes text not null default ''`;

const columns = await sql`
  select table_name, column_name, data_type
  from information_schema.columns
  where (table_name = 'loan_requests' and column_name = 'terms_version')
     or (table_name = 'notifications')
     or (table_name = 'reviews')
     or (table_name = 'users' and column_name = 'accepted_payment_methods')
     or (table_name = 'equipment_items' and column_name in ('pickup_notes', 'dropoff_notes'))
  order by table_name, column_name
`;

console.log("Migration applied. New columns/tables:");
for (const row of columns) {
  console.log(`  ${row.table_name}.${row.column_name} (${row.data_type})`);
}
