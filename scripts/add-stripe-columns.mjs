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
