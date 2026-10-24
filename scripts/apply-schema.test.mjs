import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("general schema application cannot create or apply booking payment objects", async () => {
  const [schema, applySchema, paymentMigration] = await Promise.all([
    readFile(new URL("db/schema.sql", root), "utf8"),
    readFile(new URL("scripts/apply-schema.mjs", root), "utf8"),
    readFile(new URL("scripts/add-booking-payments.sql", root), "utf8"),
  ]);

  assert.doesNotMatch(schema, /create\s+table(?:\s+if\s+not\s+exists)?\s+booking_payments\b/i);
  assert.doesNotMatch(schema, /create\s+table(?:\s+if\s+not\s+exists)?\s+booking_payment_attempts\b/i);
  assert.doesNotMatch(schema, /create\s+unique\s+index(?:\s+if\s+not\s+exists)?\s+idx_booking_payment_attempts_active\b/i);
  assert.doesNotMatch(applySchema, /add-booking-payments\.sql|bookingPaymentsMigration/);
  assert.match(paymentMigration, /create table booking_payments\s*\(/i);
  assert.match(paymentMigration, /create table booking_payment_attempts\s*\(/i);
  assert.match(paymentMigration, /create unique index idx_booking_payment_attempts_active/i);
});

test("fresh and existing database payment setup uses the guarded dedicated runner", async () => {
  const [runner, safety] = await Promise.all([
    readFile(new URL("scripts/apply-payment-migration.mjs", root), "utf8"),
    readFile(new URL("scripts/payment-migration-safety.mjs", root), "utf8"),
  ]);

  assert.match(runner, /requirePaymentMigrationOptIn\(process\.env\)/);
  assert.match(runner, /validatePaymentMigrationSql\(migrationSql\)/);
  assert.match(runner, /verifyPaymentMigrationTarget\(config\)/);
  assert.match(runner, /paymentMigrationPreflightSql\(verifiedTarget\.databaseName\)/);
  assert.match(runner, /sql\.transaction\(statements\)/);
  assert.match(safety, /class\.relname::text = any\(array\[/);
  assert.match(safety, /Payment migration objects already exist/);
});

test("payment migration statements are not idempotent so existing objects fail closed", async () => {
  const migration = await readFile(new URL("scripts/add-booking-payments.sql", root), "utf8");
  assert.doesNotMatch(migration, /create\s+table\s+if\s+not\s+exists/i);
  assert.doesNotMatch(migration, /create\s+unique\s+index\s+if\s+not\s+exists/i);
});
