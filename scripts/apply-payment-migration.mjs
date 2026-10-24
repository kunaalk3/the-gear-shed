import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import {
  buildPaymentMigrationConfig,
  parseEnvFile,
  paymentMigrationPreflightSql,
  requirePaymentMigrationOptIn,
  validatePaymentMigrationSql,
  verifyPaymentMigrationTarget,
} from "./payment-migration-safety.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

async function loadLocalEnv() {
  let contents;
  try {
    contents = await readFile(path.join(scriptDirectory, "..", ".env.local"), "utf8");
  } catch {
    throw new Error(".env.local is missing or unreadable.");
  }
  return parseEnvFile(contents);
}

async function readPaymentMigration() {
  try {
    return await readFile(path.join(scriptDirectory, "add-booking-payments.sql"), "utf8");
  } catch {
    throw new Error("The targeted booking payment migration file is missing or unreadable.");
  }
}

export async function applyPaymentMigration({ envFileValues } = {}) {
  requirePaymentMigrationOptIn(process.env);
  const loadedEnvFileValues = envFileValues ?? await loadLocalEnv();
  const config = buildPaymentMigrationConfig(process.env, loadedEnvFileValues);
  const migrationSql = await readPaymentMigration();
  const migrationStatements = validatePaymentMigrationSql(migrationSql);

  const verifiedTarget = await verifyPaymentMigrationTarget(config);
  let sql;
  try {
    sql = neon(config.databaseUrl);
  } catch {
    throw new Error("Database client could not be initialized for the verified target.");
  }

  const statements = [
    sql.query("select pg_advisory_xact_lock(1735289204, 1)"),
    sql.query(paymentMigrationPreflightSql(verifiedTarget.databaseName)),
    ...migrationStatements.map((statement) => sql.query(statement)),
  ];
  try {
    await sql.transaction(statements);
  } catch {
    throw new Error(
      "Atomic payment migration failed or found pre-existing migration objects; inspect the target schema before retrying."
    );
  }

  return migrationStatements.length;
}

async function main() {
  const statementCount = await applyPaymentMigration();
  console.log(`Payment migration completed atomically (${statementCount} statements).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safeMessage = error instanceof Error ? error.message : "Unknown failure.";
    console.error(`Payment migration stopped: ${safeMessage}`);
    process.exitCode = 1;
  });
}
