import { splitSqlStatements } from "./sql-statements.mjs";

export const PAYMENT_MIGRATION_TARGET = Object.freeze({
  branchId: "br-square-darkness-b5x5cds1",
  branchName: "before-payment-migration",
  host: "ep-plain-king-b5rqueb7.c-7.us-east-2.aws.neon.tech",
});

const REQUIRED_CONFIG = [
  "DATABASE_URL",
  "NEON_API_KEY",
  "NEON_PROJECT_ID",
  "PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME",
  "PAYMENT_MIGRATION_EXPECTED_DATABASE",
];
const PAYMENT_MIGRATION_OBJECTS = [
  "booking_payments",
  "booking_payment_attempts",
  "idx_booking_payment_attempts_active",
];
const MIGRATION_STATEMENT_STARTS = [
  /^create table booking_payments\s*\(/i,
  /^create table booking_payment_attempts\s*\(/i,
  /^create unique index idx_booking_payment_attempts_active\s+on booking_payment_attempts\s*\(/i,
];

function containsDisallowedProjectMarker(name) {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return normalizedName.split(" ").some((token) =>
    token === "prod" || token === "production" || token === "shared"
  );
}

export function requirePaymentMigrationOptIn(env) {
  if (env?.ALLOW_PAYMENT_MIGRATION !== "true") {
    throw new Error("Set ALLOW_PAYMENT_MIGRATION=true in the process environment to opt in.");
  }
}

export function parseEnvFile(contents) {
  const values = {};
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`Malformed .env.local entry on line ${index + 1}.`);

    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      if (value.length < 2 || value.at(-1) !== quote) {
        throw new Error(`Malformed quoted .env.local value on line ${index + 1}.`);
      }
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

export function buildPaymentMigrationConfig(processEnv, envFileValues) {
  const env = { ...envFileValues, ...processEnv };
  const missing = REQUIRED_CONFIG.filter((key) =>
    typeof env[key] !== "string" || env[key].trim().length === 0
  );
  if (missing.length > 0) {
    throw new Error(`Missing required payment migration configuration: ${missing.join(", ")}.`);
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
  if (databaseUrl.hostname.toLowerCase() !== PAYMENT_MIGRATION_TARGET.host) {
    throw new Error("DATABASE_URL does not point to the designated backup branch endpoint.");
  }
  if (databaseUrl.hostname.toLowerCase().includes("pooler")) {
    throw new Error("A pooled database endpoint cannot be used for this migration.");
  }
  if (databaseUrl.port && databaseUrl.port !== "5432") {
    throw new Error("DATABASE_URL uses an unapproved database port.");
  }
  const sslModes = databaseUrl.searchParams.getAll("sslmode");
  if (sslModes.length !== 1 || sslModes[0] !== "require") {
    throw new Error("DATABASE_URL must require TLS with sslmode=require.");
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL contains an invalid database name.");
  }
  if (!databaseName || databaseName !== env.PAYMENT_MIGRATION_EXPECTED_DATABASE) {
    throw new Error("DATABASE_URL database does not match PAYMENT_MIGRATION_EXPECTED_DATABASE.");
  }
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]{0,62}$/.test(databaseName)) {
    throw new Error("DATABASE_URL contains an unsupported database name.");
  }
  if (!/^[a-z0-9-]{1,60}$/.test(env.NEON_PROJECT_ID)) {
    throw new Error("NEON_PROJECT_ID has an invalid format.");
  }
  if (containsDisallowedProjectMarker(env.PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME)) {
    throw new Error("Production or shared Neon projects are not allowed for this migration.");
  }

  return {
    databaseUrl: databaseUrl.toString(),
    databaseName,
    neonApiKey: env.NEON_API_KEY,
    neonProjectId: env.NEON_PROJECT_ID,
    expectedProjectName: env.PAYMENT_MIGRATION_EXPECTED_PROJECT_NAME,
  };
}

export function validatePaymentMigrationSql(migrationSql) {
  const statements = splitSqlStatements(migrationSql);
  if (statements.length !== MIGRATION_STATEMENT_STARTS.length) {
    throw new Error("Payment migration must contain only its three approved statements.");
  }

  for (let index = 0; index < statements.length; index += 1) {
    const normalized = statements[index].trim().toLowerCase().replace(/\s+/g, " ");
    if (!MIGRATION_STATEMENT_STARTS[index].test(normalized)) {
      throw new Error("Payment migration contains an unapproved statement or object.");
    }
  }
  return statements;
}

async function fetchJson(url, apiKey, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      method: "GET",
    });
  } catch {
    throw new Error("Neon target verification request failed.");
  }
  if (!response.ok) throw new Error("Neon target verification was not authorized or returned an error.");
  try {
    return await response.json();
  } catch {
    throw new Error("Neon target verification returned invalid data.");
  }
}

function isSafeProjectName(name) {
  return typeof name === "string" &&
    name.length > 0 &&
    !containsDisallowedProjectMarker(name);
}

export async function verifyPaymentMigrationTarget(config, fetchImpl = fetch) {
  const baseUrl = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(config.neonProjectId)}`;
  const branchPath = `/branches/${PAYMENT_MIGRATION_TARGET.branchId}`;
  const [projectData, branchData, endpointData, databaseData] = await Promise.all([
    fetchJson(baseUrl, config.neonApiKey, fetchImpl),
    fetchJson(`${baseUrl}${branchPath}`, config.neonApiKey, fetchImpl),
    fetchJson(`${baseUrl}${branchPath}/endpoints`, config.neonApiKey, fetchImpl),
    fetchJson(`${baseUrl}${branchPath}/databases`, config.neonApiKey, fetchImpl),
  ]);

  const project = projectData?.project;
  if (
    project?.id !== config.neonProjectId ||
    project?.name !== config.expectedProjectName ||
    !isSafeProjectName(project?.name)
  ) {
    throw new Error("Neon project identity is missing, inconsistent, production, or shared.");
  }

  const branch = branchData?.branch;
  if (
    branch?.id !== PAYMENT_MIGRATION_TARGET.branchId ||
    branch?.project_id !== project.id ||
    branch?.name !== PAYMENT_MIGRATION_TARGET.branchName ||
    branch?.current_state !== "ready" ||
    branch?.default !== false ||
    typeof branch?.parent_id !== "string" ||
    branch.parent_id.length === 0 ||
    branch.parent_id === branch.id
  ) {
    throw new Error("Neon branch is not the verified non-default backup branch.");
  }

  const endpoints = endpointData?.endpoints;
  if (!Array.isArray(endpoints)) {
    throw new Error("Neon endpoint verification is missing or incomplete.");
  }
  const matchingEndpoints = endpoints.filter((endpoint) =>
    endpoint?.id &&
    endpoint?.host?.toLowerCase() === PAYMENT_MIGRATION_TARGET.host &&
    endpoint?.branch_id === branch.id &&
    endpoint?.project_id === project.id &&
    endpoint?.type === "read_write" &&
    endpoint?.disabled === false &&
    (endpoint?.current_state === "idle" || endpoint?.current_state === "active")
  );
  if (matchingEndpoints.length !== 1) {
    throw new Error("Neon did not verify exactly one active read-write endpoint for the designated backup branch.");
  }

  const databases = databaseData?.databases;
  if (!Array.isArray(databases)) {
    throw new Error("Neon database verification is missing or incomplete.");
  }
  const matchingDatabases = databases.filter((database) =>
    database?.branch_id === branch.id &&
    database?.name === config.databaseName
  );
  if (matchingDatabases.length !== 1) {
    throw new Error("Neon did not verify exactly one matching database on the designated backup branch.");
  }

  return {
    branchId: branch.id,
    branchName: branch.name,
    host: matchingEndpoints[0].host,
    databaseName: matchingDatabases[0].name,
  };
}

export function paymentMigrationPreflightSql(expectedDatabase) {
  const escapedDatabase = expectedDatabase.replaceAll("'", "''");
  const objectNames = PAYMENT_MIGRATION_OBJECTS.map((name) => `'${name}'`).join(",\n        ");
  return `do $$
begin
  if current_database() <> '${escapedDatabase}' then
    raise exception 'Connected database does not match the verified Neon target';
  end if;

  if current_schema() <> 'public' then
    raise exception 'Payment migration requires the public schema';
  end if;

  if exists (
    select 1
    from pg_class class
    join pg_namespace schema on schema.oid = class.relnamespace
    where schema.nspname = current_schema()
      and class.relname::text = any(array[${objectNames}]::text[])
  ) then
    raise exception 'Payment migration objects already exist; inspect schema before proceeding';
  end if;
end $$`;
}
