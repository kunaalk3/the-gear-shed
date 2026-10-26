import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { splitSqlStatements } from "./sql-statements.mjs";

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
const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
const schema = readFileSync(schemaPath, "utf8");
const equipmentFieldsMigrationPath = path.join(__dirname, "add-equipment-listing-fields.sql");
const equipmentFieldsMigration = readFileSync(equipmentFieldsMigrationPath, "utf8");
const bookingHistoryMigrationPath = path.join(__dirname, "add-booking-cancellation-history.sql");
const bookingHistoryMigration = readFileSync(bookingHistoryMigrationPath, "utf8");
const bookingFulfillmentMigrationPath = path.join(__dirname, "add-booking-fulfillment.sql");
const bookingFulfillmentMigration = readFileSync(bookingFulfillmentMigrationPath, "utf8");
const depositChargeAttemptsMigrationPath = path.join(__dirname, "add-deposit-charge-attempts.sql");
const depositChargeAttemptsMigration = readFileSync(depositChargeAttemptsMigrationPath, "utf8");

async function applySqlFile(contents, { transactional = false } = {}) {
  const statements = splitSqlStatements(contents);

  if (transactional) {
    const startsTransaction = /^begin(?:\s+transaction)?$/i.test(statements[0] ?? "");
    const endsTransaction = /^commit(?:\s+transaction)?$/i.test(statements.at(-1) ?? "");
    if (startsTransaction !== endsTransaction) {
      throw new Error("Migration must have matching BEGIN and COMMIT statements.");
    }
    if (startsTransaction) {
      statements.shift();
      statements.pop();
    }

    if (statements.length > 0) {
      await sql.transaction((transaction) =>
        statements.map((statement) => transaction.query(statement))
      );
    }
  } else {
    for (const statement of statements) {
      await sql.query(statement);
    }
  }

  return statements.length;
}

const schemaStatementCount = await applySqlFile(schema);
const equipmentFieldsMigrationStatementCount = await applySqlFile(equipmentFieldsMigration, {
  transactional: true,
});
const bookingHistoryMigrationStatementCount = await applySqlFile(bookingHistoryMigration, {
  transactional: true,
});
const bookingFulfillmentMigrationStatementCount = await applySqlFile(bookingFulfillmentMigration, {
  transactional: true,
});
const depositChargeAttemptsMigrationStatementCount = await applySqlFile(depositChargeAttemptsMigration, {
  transactional: true,
});

console.log(
  `Applied ${schemaStatementCount} schema statements, ${equipmentFieldsMigrationStatementCount} equipment listing migration statements, ${bookingHistoryMigrationStatementCount} booking history migration statements, ${bookingFulfillmentMigrationStatementCount} booking fulfillment migration statements, and ${depositChargeAttemptsMigrationStatementCount} deposit charge attempt migration statements.`
);
