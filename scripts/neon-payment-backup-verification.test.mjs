import assert from "node:assert/strict";
import test from "node:test";
import {
  NEON_PAYMENT_BACKUP,
  verifyNeonPaymentBackup,
} from "./neon-payment-backup-verification.mjs";

const env = {
  NEON_API_KEY: "mock-api-key",
  NEON_PROJECT_ID: NEON_PAYMENT_BACKUP.projectId,
};

function response(body, ok = true) {
  return { ok, json: async () => body };
}

function mockNeonFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method !== "GET") throw new Error("Unexpected non-GET request");

    if (url.endsWith("/endpoints")) {
      return response(overrides.endpoints ?? {
        endpoints: [{
          id: "ep-backup",
          host: NEON_PAYMENT_BACKUP.endpointHost,
          branch_id: NEON_PAYMENT_BACKUP.branchId,
          project_id: NEON_PAYMENT_BACKUP.projectId,
          type: "read_write",
          disabled: false,
          current_state: "idle",
        }],
      });
    }
    if (url.endsWith("/databases")) {
      return response(overrides.databases ?? {
        databases: [{
          branch_id: NEON_PAYMENT_BACKUP.branchId,
          name: NEON_PAYMENT_BACKUP.databaseName,
        }],
      });
    }
    if (url.endsWith(`/branches/${NEON_PAYMENT_BACKUP.branchId}`)) {
      return response(overrides.backup ?? {
        branch: {
          id: NEON_PAYMENT_BACKUP.branchId,
          project_id: NEON_PAYMENT_BACKUP.projectId,
          name: NEON_PAYMENT_BACKUP.branchName,
          current_state: "ready",
          default: false,
          parent_id: "br-production",
        },
      });
    }
    if (url.endsWith("/branches/br-production")) {
      return response(overrides.parent ?? {
        branch: {
          id: "br-production",
          project_id: NEON_PAYMENT_BACKUP.projectId,
          name: NEON_PAYMENT_BACKUP.parentBranchName,
          current_state: "ready",
          default: true,
        },
      });
    }
    return response(overrides.project ?? {
      project: {
        id: NEON_PAYMENT_BACKUP.projectId,
        name: "gear-shed",
      },
    });
  };
  return { fetchImpl, calls };
}

test("requires only the API key and expected project ID, without making requests when missing", async () => {
  let requests = 0;
  await assert.rejects(
    verifyNeonPaymentBackup({}, async () => {
      requests += 1;
      return response({});
    }),
    /NEON_API_KEY/
  );
  await assert.rejects(
    verifyNeonPaymentBackup({ NEON_API_KEY: "mock-api-key" }, async () => {
      requests += 1;
      return response({});
    }),
    /NEON_PROJECT_ID/
  );
  await assert.rejects(
    verifyNeonPaymentBackup({ ...env, NEON_PROJECT_ID: "wrong-project" }, async () => {
      requests += 1;
      return response({});
    }),
    /NEON_PROJECT_ID/
  );
  assert.equal(requests, 0);
});

test("verifies project, backup branch, parent, endpoint and database using GET only", async () => {
  const { fetchImpl, calls } = mockNeonFetch();
  const result = await verifyNeonPaymentBackup(env, fetchImpl);

  assert.deepEqual(result, {
    project: { id: NEON_PAYMENT_BACKUP.projectId, name: "gear-shed" },
    backupBranch: {
      id: NEON_PAYMENT_BACKUP.branchId,
      name: NEON_PAYMENT_BACKUP.branchName,
      default: false,
    },
    parentBranch: { id: "br-production", name: "production", default: true },
    computeEndpoint: {
      id: "ep-backup",
      host: NEON_PAYMENT_BACKUP.endpointHost,
      state: "idle",
      type: "read_write",
    },
    database: "neondb",
    verification: "passed",
  });
  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ options }) => options.method === "GET"));
  assert.ok(calls.every(({ options }) => options.body === undefined));
  assert.ok(calls.some(({ url }) => url.endsWith("/branches/br-production")));
});

test("fails closed for production/default backup branches and unexpected parents", async (t) => {
  const cases = [
    ["default backup branch", { backup: { branch: {
      id: NEON_PAYMENT_BACKUP.branchId,
      project_id: NEON_PAYMENT_BACKUP.projectId,
      name: NEON_PAYMENT_BACKUP.branchName,
      current_state: "ready",
      default: true,
      parent_id: "br-production",
    } } }],
    ["wrong parent", { parent: { branch: {
      id: "br-production",
      project_id: NEON_PAYMENT_BACKUP.projectId,
      name: "not-production",
      current_state: "ready",
      default: true,
    } } }],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, async () => {
      const { fetchImpl } = mockNeonFetch(overrides);
      await assert.rejects(verifyNeonPaymentBackup(env, fetchImpl));
    });
  }
});

test("fails closed when project, endpoint, database, or Neon API response is inconsistent", async (t) => {
  const cases = [
    ["project mismatch", { project: { project: { id: "wrong", name: "gear-shed" } } }],
    ["wrong endpoint host", { endpoints: { endpoints: [{
      id: "ep-backup",
      host: "wrong.example",
      branch_id: NEON_PAYMENT_BACKUP.branchId,
      project_id: NEON_PAYMENT_BACKUP.projectId,
      type: "read_write",
      disabled: false,
      current_state: "idle",
    }] } }],
    ["wrong database", { databases: { databases: [{
      branch_id: NEON_PAYMENT_BACKUP.branchId,
      name: "wrong_database",
    }] } }],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, async () => {
      const { fetchImpl } = mockNeonFetch(overrides);
      await assert.rejects(verifyNeonPaymentBackup(env, fetchImpl));
    });
  }

  await assert.rejects(
    verifyNeonPaymentBackup(env, async () => response({}, false)),
    /unauthorized or returned an error/
  );
  await assert.rejects(
    verifyNeonPaymentBackup(env, async () => {
      throw new Error("secret-like raw error");
    }),
    /request failed/
  );
});
