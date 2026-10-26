import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYMENT_MIGRATION_TARGET,
  buildPaymentMigrationConfig,
  parseEnvFile,
  requirePaymentMigrationOptIn,
  validatePaymentMigrationSql,
  verifyPaymentMigrationTarget,
} from "./payment-migration-safety.mjs";
import { applyPaymentMigration } from "./apply-payment-migration.mjs";

const envFileValues = {
  DATABASE_URL: `postgresql://test_user:test_password@${PAYMENT_MIGRATION_TARGET.host}/safe_test_db?sslmode=require`,
  NEON_API_KEY: "test-api-key",
  NEON_PROJECT_ID: "safe-test-project",
  PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME: "gear-shed-test",
  PAYMENT_MIGRATION_EXPECTED_DATABASE: "safe_test_db",
};
const optedInProcessEnv = { ALLOW_PAYMENT_MIGRATION: "true" };

function apiResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function verifiedApiFetch(overrides = {}) {
  return async (url) => {
    if (url.endsWith("/endpoints")) {
      return apiResponse(overrides.endpoints ?? {
        endpoints: [{
          id: "ep-backup",
          host: PAYMENT_MIGRATION_TARGET.host,
          branch_id: PAYMENT_MIGRATION_TARGET.branchId,
          project_id: envFileValues.NEON_PROJECT_ID,
          type: "read_write",
          current_state: "idle",
          disabled: false,
        }],
      });
    }
    if (url.endsWith("/databases")) {
      return apiResponse(overrides.databases ?? {
        databases: [{
          branch_id: PAYMENT_MIGRATION_TARGET.branchId,
          name: envFileValues.PAYMENT_MIGRATION_EXPECTED_DATABASE,
        }],
      });
    }
    if (url.endsWith(`/branches/${PAYMENT_MIGRATION_TARGET.branchId}`)) {
      return apiResponse(overrides.branch ?? {
        branch: {
          id: PAYMENT_MIGRATION_TARGET.branchId,
          project_id: envFileValues.NEON_PROJECT_ID,
          name: PAYMENT_MIGRATION_TARGET.branchName,
          current_state: "ready",
          default: false,
          parent_id: "br-parent",
        },
      });
    }
    return apiResponse(overrides.project ?? {
      project: {
        id: envFileValues.NEON_PROJECT_ID,
        name: envFileValues.PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME,
      },
    });
  };
}

function createMockFetch({
  apiFetch = verifiedApiFetch(),
  databaseName = envFileValues.PAYMENT_MIGRATION_EXPECTED_DATABASE,
  preexistingObject = false,
} = {}) {
  const executedMigrationStatements = [];
  let transactionStatements = [];
  let databaseRequestCount = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url.startsWith("https://console.neon.tech/")) return apiFetch(url, options);
    if (url.endsWith("/sql") && options.method === "POST") {
      databaseRequestCount += 1;
      const payload = JSON.parse(options.body);
      transactionStatements = payload.queries.map((query) => query.query);
      for (const statement of transactionStatements) {
        if (statement.includes("raise exception")) {
          if (!statement.includes(`'${databaseName.replaceAll("'", "''")}'`)) {
            return apiResponse({ message: "Wrong database." }, false);
          }
          if (preexistingObject) {
            return apiResponse({ message: "Existing payment object." }, false);
          }
          continue;
        }
        if (
          statement.startsWith("create table") ||
          statement.startsWith("create unique index")
        ) {
          executedMigrationStatements.push(statement);
        }
      }
      return apiResponse({
        results: transactionStatements.map(() => ({ fields: [], rows: [] })),
      });
    }
    throw new Error("Unexpected network request.");
  };
  return {
    fetchImpl,
    executedMigrationStatements,
    get transactionStatements() {
      return transactionStatements;
    },
    get databaseRequestCount() {
      return databaseRequestCount;
    },
  };
}

async function withMockFetch(fetchImpl, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withPaymentMigrationOptIn(callback) {
  const originalValue = process.env.ALLOW_PAYMENT_MIGRATION;
  process.env.ALLOW_PAYMENT_MIGRATION = "true";
  try {
    return await callback();
  } finally {
    if (originalValue === undefined) {
      delete process.env.ALLOW_PAYMENT_MIGRATION;
    } else {
      process.env.ALLOW_PAYMENT_MIGRATION = originalValue;
    }
  }
}

test("migration requires exact explicit process opt-in", () => {
  assert.throws(() => requirePaymentMigrationOptIn({}), /ALLOW_PAYMENT_MIGRATION=true/);
  assert.throws(
    () => requirePaymentMigrationOptIn({ ALLOW_PAYMENT_MIGRATION: "True" }),
    /ALLOW_PAYMENT_MIGRATION=true/
  );
  assert.doesNotThrow(() => requirePaymentMigrationOptIn(optedInProcessEnv));
});

test("environment parsing rejects malformed entries without disclosing values", () => {
  assert.throws(() => parseEnvFile("DATABASE_URL"), /Malformed .env.local entry/);
  assert.throws(() => parseEnvFile('DATABASE_URL="secret'), /Malformed quoted .env.local value/);
});

test("configuration rejects missing, malformed, production, shared, and wrong-host targets", () => {
  assert.throws(() => buildPaymentMigrationConfig({}, {}), /Missing required payment migration configuration/);
  assert.throws(
    () => buildPaymentMigrationConfig({}, { ...envFileValues, DATABASE_URL: "not-a-url" }),
    /valid PostgreSQL connection URL/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      DATABASE_URL: "postgresql://not-the-target.example/safe_test_db?sslmode=require",
    }),
    /designated backup branch endpoint/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME: "gear-shed-shared",
    }),
    /Production or shared/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME: "gear-shed-production",
    }),
    /Production or shared/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME: "gear_shed_shared",
    }),
    /Production or shared/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      DATABASE_URL: envFileValues.DATABASE_URL.replace("safe_test_db", "wrong_db"),
    }),
    /does not match PAYMENT_MIGRATION_EXPECTED_DATABASE/
  );
  assert.throws(
    () => buildPaymentMigrationConfig({}, {
      ...envFileValues,
      DATABASE_URL: envFileValues.DATABASE_URL.replace("safe_test_db", "invalid%2Fname"),
      PAYMENT_MIGRATION_EXPECTED_DATABASE: "invalid/name",
    }),
    /unsupported database name/
  );
});

test("migration SQL is restricted to its three named objects and rejects IF NOT EXISTS", () => {
  const statements = validatePaymentMigrationSql(
    "create table booking_payments (id text); " +
      "create table booking_payment_attempts (id text); " +
      "create unique index idx_booking_payment_attempts_active on booking_payment_attempts(id);"
  );
  assert.equal(statements.length, 3);
  assert.throws(
    () => validatePaymentMigrationSql("create table other_table (id text);"),
    /only its three approved statements/
  );
  assert.throws(
    () => validatePaymentMigrationSql(
      "create table if not exists booking_payments (id text); " +
        "create table booking_payment_attempts (id text); " +
        "create unique index idx_booking_payment_attempts_active on booking_payment_attempts(id);"
    ),
    /unapproved statement or object/
  );
});

test("target verification independently checks Neon project, branch, endpoint and database responses", async () => {
  const config = buildPaymentMigrationConfig({}, envFileValues);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return verifiedApiFetch()(url);
  };
  const target = await verifyPaymentMigrationTarget(config, fetchImpl);

  assert.deepEqual(target, {
    branchId: PAYMENT_MIGRATION_TARGET.branchId,
    branchName: PAYMENT_MIGRATION_TARGET.branchName,
    host: PAYMENT_MIGRATION_TARGET.host,
    databaseName: envFileValues.PAYMENT_MIGRATION_EXPECTED_DATABASE,
  });
  assert.equal(calls.length, 4);
  assert.ok(calls.some(({ url }) => /\/projects\/safe-test-project$/.test(url)));
  assert.ok(calls.every(({ options }) => options.method === "GET"));
});

test("project or branch mismatch fails closed", async () => {
  const config = buildPaymentMigrationConfig({}, envFileValues);
  const badResponses = [
    { project: { project: { id: "other-project", name: "gear-shed-test" } } },
    { project: { project: { id: envFileValues.NEON_PROJECT_ID, name: "gear-shed-prod" } } },
    { branch: { branch: {
      id: "br-wrong",
      project_id: envFileValues.NEON_PROJECT_ID,
      name: "main",
      current_state: "ready",
      default: true,
      parent_id: "br-parent",
    } } },
    { branch: { branch: {
      id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      name: PAYMENT_MIGRATION_TARGET.branchName,
      current_state: "ready",
      default: false,
    } } },
  ];
  for (const responses of badResponses) {
    await assert.rejects(
      verifyPaymentMigrationTarget(config, verifiedApiFetch(responses))
    );
  }
});

test("missing, disabled, incomplete, wrong-host or inconsistent endpoints fail closed", async () => {
  const config = buildPaymentMigrationConfig({}, envFileValues);
  const incompleteEndpoints = [
    {},
    { endpoints: [{}] },
    { endpoints: [{
      id: "ep-backup",
      host: PAYMENT_MIGRATION_TARGET.host,
      branch_id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "idle",
    }] },
    { endpoints: [{
      id: "ep-backup",
      host: PAYMENT_MIGRATION_TARGET.host,
      branch_id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "suspended",
      disabled: false,
    }] },
    { endpoints: [{
      id: "ep-backup",
      host: "ep-other.c-7.us-east-2.aws.neon.tech",
      branch_id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "idle",
      disabled: false,
    }] },
    { endpoints: [{
      id: "ep-backup",
      host: PAYMENT_MIGRATION_TARGET.host,
      branch_id: "br-other",
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "idle",
      disabled: false,
    }] },
  ];
  for (const endpoints of incompleteEndpoints) {
    await assert.rejects(
      verifyPaymentMigrationTarget(config, verifiedApiFetch({ endpoints }))
    );
  }
});

test("API failures or malformed responses fail closed", async () => {
  const config = buildPaymentMigrationConfig({}, envFileValues);
  await assert.rejects(
    verifyPaymentMigrationTarget(config, async () => apiResponse({}, false)),
    /not authorized or returned an error/
  );
  await assert.rejects(
    verifyPaymentMigrationTarget(config, async () => {
      throw new Error("API error containing a fake secret");
    }),
    /request failed/
  );
  await assert.rejects(
    verifyPaymentMigrationTarget(config, async () => ({
      ok: true,
      json: async () => { throw new Error("malformed"); },
    })),
    /invalid data/
  );
});

test("direct executor call cannot bypass opt-in or supply a target or SQL payload", async () => {
  let requests = 0;
  await assert.rejects(
    withPaymentMigrationOptIn(async () => {
      delete process.env.ALLOW_PAYMENT_MIGRATION;
      return withMockFetch(async () => {
        requests += 1;
        throw new Error("Must not access Neon.");
      }, () => applyPaymentMigration({
        processEnv: optedInProcessEnv,
        envFileValues,
        verifiedTarget: {
          branchId: PAYMENT_MIGRATION_TARGET.branchId,
          branchName: PAYMENT_MIGRATION_TARGET.branchName,
          host: PAYMENT_MIGRATION_TARGET.host,
          databaseName: envFileValues.PAYMENT_MIGRATION_EXPECTED_DATABASE,
        },
        migrationSql: "drop table loan_requests;",
      }));
    }),
    /ALLOW_PAYMENT_MIGRATION=true/
  );
  assert.equal(requests, 0);
});

test("unverified branch, database, or connected database cannot submit migration SQL", async () => {
  const failingApiResponses = [
    verifiedApiFetch({ branch: { branch: { id: "br-wrong" } } }),
    verifiedApiFetch({
      databases: { databases: [{ branch_id: "br-wrong", name: envFileValues.PAYMENT_MIGRATION_EXPECTED_DATABASE }] },
    }),
    verifiedApiFetch({
      databases: { databases: [{ branch_id: PAYMENT_MIGRATION_TARGET.branchId, name: "wrong_database" }] },
    }),
    async () => apiResponse({}, false),
  ];
  for (const apiFetch of failingApiResponses) {
    const mock = createMockFetch({ apiFetch });
    await assert.rejects(
      withPaymentMigrationOptIn(() =>
        withMockFetch(mock.fetchImpl, () => applyPaymentMigration({ envFileValues }))
      )
    );
    assert.equal(mock.databaseRequestCount, 0);
  }

  const mock = createMockFetch({ databaseName: "wrong_database" });
  await assert.rejects(
    withPaymentMigrationOptIn(() =>
      withMockFetch(mock.fetchImpl, () => applyPaymentMigration({ envFileValues }))
    ),
    /Atomic payment migration failed/
  );
  assert.equal(mock.databaseRequestCount, 1);
  assert.deepEqual(mock.executedMigrationStatements, []);
});

test("incomplete or disabled endpoint responses cannot initialize SQL or submit the migration", async () => {
  const badEndpoints = [
    {},
    { endpoints: [{}] },
    { endpoints: [{
      id: "ep-backup",
      host: PAYMENT_MIGRATION_TARGET.host,
      branch_id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "idle",
    }] },
    { endpoints: [{
      id: "ep-backup",
      host: PAYMENT_MIGRATION_TARGET.host,
      branch_id: PAYMENT_MIGRATION_TARGET.branchId,
      project_id: envFileValues.NEON_PROJECT_ID,
      type: "read_write",
      current_state: "idle",
      disabled: true,
    }] },
  ];
  for (const endpoints of badEndpoints) {
    const mock = createMockFetch({ apiFetch: verifiedApiFetch({ endpoints }) });
    await assert.rejects(
      withMockFetch(mock.fetchImpl, () => applyPaymentMigration({
        processEnv: optedInProcessEnv,
        envFileValues,
      }))
    );
    assert.equal(mock.databaseRequestCount, 0);
  }
});

test("pre-existing migration objects abort the locked transaction before any DDL", async () => {
  const mock = createMockFetch({ preexistingObject: true });
  await assert.rejects(
    withPaymentMigrationOptIn(() =>
      withMockFetch(mock.fetchImpl, () => applyPaymentMigration({ envFileValues }))
    ),
    /Atomic payment migration failed or found pre-existing migration objects/
  );
  assert.equal(mock.databaseRequestCount, 1);
  assert.deepEqual(mock.executedMigrationStatements, []);
  assert.match(mock.transactionStatements[0], /pg_advisory_xact_lock/);
  assert.match(mock.transactionStatements[1], /raise exception/);
  assert.match(mock.transactionStatements[1], /current_database\(\)/);
  assert.match(mock.transactionStatements[1], /current_schema\(\)/);
});

test("successful execution is fixed to the booking payment migration and orders lock/preflight before DDL", async () => {
  const mock = createMockFetch();
  const result = await withPaymentMigrationOptIn(() =>
    withMockFetch(
      mock.fetchImpl,
      () => applyPaymentMigration({
        envFileValues,
        migrationSql: "drop table loan_requests;",
        verifiedTarget: { host: "untrusted.example" },
      })
    )
  );

  assert.equal(result, 3);
  assert.equal(mock.databaseRequestCount, 1);
  assert.match(mock.transactionStatements[0], /pg_advisory_xact_lock/);
  assert.match(mock.transactionStatements[1], /raise exception/);
  assert.match(mock.transactionStatements[1], /current_schema\(\)/);
  assert.equal(mock.transactionStatements.length, 5);
  assert.equal(mock.executedMigrationStatements.length, 3);
  assert.match(mock.executedMigrationStatements[0], /^create table booking_payments/);
  assert.match(mock.executedMigrationStatements[1], /^create table booking_payment_attempts/);
  assert.match(mock.executedMigrationStatements[2], /^create unique index idx_booking_payment_attempts_active/);
});
