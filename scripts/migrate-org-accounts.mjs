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
