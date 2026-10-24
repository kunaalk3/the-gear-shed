export const NEON_PAYMENT_BACKUP = Object.freeze({
  projectId: "flat-sound-68750415",
  branchId: "br-square-darkness-b5x5cds1",
  branchName: "before-payment-migration",
  parentBranchName: "production",
  endpointHost: "ep-plain-king-b5rqueb7.c-7.us-east-2.aws.neon.tech",
  databaseName: "neondb",
});

const DISALLOWED_NAME_MARKERS = new Set(["prod", "production", "shared"]);

function hasDisallowedMarker(value) {
  return value.toLowerCase().split(/[^a-z0-9]+/).some((part) =>
    DISALLOWED_NAME_MARKERS.has(part)
  );
}

function readRequiredEnvironment(env, name) {
  const value = env?.[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return value.trim();
}

async function getJson(url, apiKey, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error("Neon read-only API request failed.");
  }

  if (!response.ok) {
    throw new Error("Neon read-only API request was unauthorized or returned an error.");
  }

  try {
    return await response.json();
  } catch {
    throw new Error("Neon read-only API returned invalid data.");
  }
}

function requireBranchIdentity(branch, expected) {
  if (
    branch?.id !== expected.id ||
    branch?.project_id !== expected.projectId ||
    branch?.name !== expected.name ||
    branch?.current_state !== "ready" ||
    branch?.default !== false ||
    typeof branch?.parent_id !== "string" ||
    branch.parent_id.length === 0 ||
    branch.parent_id === branch.id
  ) {
    throw new Error("Neon backup branch identity or isolation could not be verified.");
  }
}

export async function verifyNeonPaymentBackup(env, fetchImpl = fetch) {
  const apiKey = readRequiredEnvironment(env, "NEON_API_KEY");
  const projectId = readRequiredEnvironment(env, "NEON_PROJECT_ID");
  if (projectId !== NEON_PAYMENT_BACKUP.projectId) {
    throw new Error("NEON_PROJECT_ID does not match the expected Gear Shed Neon project.");
  }

  const projectUrl =
    `https://console.neon.tech/api/v2/projects/${encodeURIComponent(projectId)}`;
  const projectData = await getJson(projectUrl, apiKey, fetchImpl);
  const project = projectData?.project;
  if (
    project?.id !== projectId ||
    typeof project?.name !== "string" ||
    project.name.trim().length === 0 ||
    hasDisallowedMarker(project.name)
  ) {
    throw new Error("Neon project identity is missing, inconsistent, or not a safe target.");
  }

  const branchUrl =
    `${projectUrl}/branches/${encodeURIComponent(NEON_PAYMENT_BACKUP.branchId)}`;
  const branchData = await getJson(branchUrl, apiKey, fetchImpl);
  const branch = branchData?.branch;
  requireBranchIdentity(branch, {
    id: NEON_PAYMENT_BACKUP.branchId,
    projectId,
    name: NEON_PAYMENT_BACKUP.branchName,
  });

  const parentData = await getJson(
    `${projectUrl}/branches/${encodeURIComponent(branch.parent_id)}`,
    apiKey,
    fetchImpl
  );
  const parent = parentData?.branch;
  if (
    parent?.id !== branch.parent_id ||
    parent?.project_id !== projectId ||
    parent?.name !== NEON_PAYMENT_BACKUP.parentBranchName ||
    parent?.default !== true ||
    parent?.current_state !== "ready"
  ) {
    throw new Error("Neon backup branch parent could not be verified as production.");
  }

  const [endpointData, databaseData] = await Promise.all([
    getJson(`${branchUrl}/endpoints`, apiKey, fetchImpl),
    getJson(`${branchUrl}/databases`, apiKey, fetchImpl),
  ]);

  const endpoints = endpointData?.endpoints;
  const matchingEndpoints = Array.isArray(endpoints)
    ? endpoints.filter((endpoint) =>
        typeof endpoint?.id === "string" &&
        endpoint.host?.toLowerCase() === NEON_PAYMENT_BACKUP.endpointHost &&
        endpoint.branch_id === branch.id &&
        endpoint.project_id === projectId &&
        endpoint.type === "read_write" &&
        endpoint.disabled === false &&
        (endpoint.current_state === "idle" || endpoint.current_state === "active")
      )
    : [];
  if (matchingEndpoints.length !== 1) {
    throw new Error("Neon compute endpoint identity or readiness could not be verified.");
  }

  const databases = databaseData?.databases;
  const matchingDatabases = Array.isArray(databases)
    ? databases.filter((database) =>
        database?.branch_id === branch.id &&
        database?.name === NEON_PAYMENT_BACKUP.databaseName
      )
    : [];
  if (matchingDatabases.length !== 1) {
    throw new Error("Neon database identity could not be verified.");
  }

  return {
    project: { id: project.id, name: project.name },
    backupBranch: { id: branch.id, name: branch.name, default: branch.default },
    parentBranch: { id: parent.id, name: parent.name, default: parent.default },
    computeEndpoint: {
      id: matchingEndpoints[0].id,
      host: matchingEndpoints[0].host,
      state: matchingEndpoints[0].current_state,
      type: matchingEndpoints[0].type,
    },
    database: matchingDatabases[0].name,
    verification: "passed",
  };
}
