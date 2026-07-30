#!/usr/bin/env node
/**
 * Apply the checked-in Render Static response-boundary contract to existing services.
 *
 * Render's CLI exposes Blueprint validation but not static header/route mutation. The
 * public API is used here with the GitHub Actions RENDER_API_KEY only; this module
 * never includes or prints that credential in a request body, record, or log.
 */

export const RENDER_API_BASE = "https://api.render.com/v1";
export const REQUIRED_HEADER_RULES = [
  { path: "/*", name: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { path: "/*", name: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { path: "/*", name: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { path: "/*", name: "X-Content-Type-Options", value: "nosniff" },
  { path: "/*", name: "X-Frame-Options", value: "DENY" },
  { path: "/__deployment/*", name: "Cache-Control", value: "no-store" },
  { path: "/", name: "Cache-Control", value: "no-cache" },
  { path: "/*.html", name: "Cache-Control", value: "no-cache" },
  { path: "/**/*.html", name: "Cache-Control", value: "no-cache" },
];
export const REQUIRED_ROUTE_RULES = [
  {
    type: "rewrite",
    source: "/__deployment/api",
    destination: "/__deployment/api.json",
  },
];

const EXPECTED_SERVICES = {
  candidate: { name: "gyf-expo-web-candidate" },
  production: { name: "gyf-expo-web" },
};

function requestPath(serviceId, resource) {
  return `/services/${encodeURIComponent(serviceId)}/${resource}`;
}

function parseCollection(payload, property) {
  if (!Array.isArray(payload)) throw new Error("Render API returned an invalid collection");
  return payload.map((item) => item[property] ?? item);
}

function normaliseHeader(rule) {
  return { path: rule.path, name: rule.name, value: rule.value };
}

function normaliseRoute(rule) {
  return { type: rule.type, source: rule.source, destination: rule.destination };
}

function key(value) {
  return JSON.stringify(value);
}

function setOf(values) {
  return new Set(values.map(key));
}

function assertExactContract(current, desired, label) {
  const currentSet = setOf(current);
  const desiredSet = setOf(desired);
  const unexpected = current.filter((item) => !desiredSet.has(key(item)));
  if (unexpected.length) {
    throw new Error(`${label} contains unmanaged rules; refusing to delete provider configuration`);
  }
  if (currentSet.size !== desiredSet.size) return false;
  return [...desiredSet].every((item) => currentSet.has(item));
}

function safeError(method, path, status) {
  return new Error(`Render API ${method} ${path} failed with HTTP ${status}`);
}

async function apiRequest(fetchImpl, apiKey, method, path, body, apiBase = RENDER_API_BASE) {
  const response = await fetchImpl(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw safeError(method, path, response.status);
  if (response.status === 204) return null;
  return response.json();
}

async function listRules(
  fetchImpl,
  apiKey,
  serviceId,
  resource,
  property,
  apiBase = RENDER_API_BASE,
) {
  const rules = [];
  let cursor;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const payload = await apiRequest(
      fetchImpl,
      apiKey,
      "GET",
      `${requestPath(serviceId, resource)}?${query}`,
      undefined,
      apiBase,
    );
    if (!Array.isArray(payload)) throw new Error(`Render API returned invalid ${resource} rules`);
    rules.push(
      ...parseCollection(payload, property).map(
        property === "header" ? normaliseHeader : normaliseRoute,
      ),
    );
    const next = payload.at(-1)?.cursor;
    if (!next || next === cursor) break;
    cursor = next;
  } while (true);
  return rules;
}

function validateService(service, serviceId, workspaceId, expectedName) {
  if (!service || service.id !== serviceId)
    throw new Error(`Render service lookup did not return ${serviceId}`);
  if (service.ownerId !== workspaceId)
    throw new Error(`Render service ${serviceId} is not owned by the approved workspace`);
  if (service.name !== expectedName)
    throw new Error(`Render service ${serviceId} is not the approved ${expectedName} service`);
  if (service.type !== "static_site")
    throw new Error(`Render service ${serviceId} is not a static site`);
}

async function inspectService(
  fetchImpl,
  apiKey,
  serviceId,
  workspaceId,
  expectedName,
  apiBase = RENDER_API_BASE,
) {
  const service = await apiRequest(
    fetchImpl,
    apiKey,
    "GET",
    `/services/${encodeURIComponent(serviceId)}`,
    undefined,
    apiBase,
  );
  validateService(service, serviceId, workspaceId, expectedName);
  const [headers, routes] = await Promise.all([
    listRules(fetchImpl, apiKey, serviceId, "headers", "header", apiBase),
    listRules(fetchImpl, apiKey, serviceId, "routes", "route", apiBase),
  ]);
  return {
    service,
    headers,
    routes,
    headersComplete: assertExactContract(headers, REQUIRED_HEADER_RULES, `${expectedName} headers`),
    routesComplete: assertExactContract(routes, REQUIRED_ROUTE_RULES, `${expectedName} routes`),
  };
}

export function providerRequestBody() {
  return {
    headers: REQUIRED_HEADER_RULES.map(normaliseHeader),
    routes: REQUIRED_ROUTE_RULES.map(normaliseRoute),
  };
}

export async function applyRenderStaticConfig({
  apiKey,
  workspaceId,
  candidateServiceId,
  productionServiceId,
  fetchImpl = fetch,
  log = () => {},
  apiBase = RENDER_API_BASE,
}) {
  if (!apiKey) throw new Error("RENDER_API_KEY is required");
  if (!workspaceId) throw new Error("RENDER_WORKSPACE_ID is required");
  if (!candidateServiceId || !productionServiceId || candidateServiceId === productionServiceId)
    throw new Error("distinct candidate and production service IDs are required");

  // Inspect both services before the first PUT. Unexpected existing rules are a hard
  // stop rather than an implicit destructive cleanup of manually-created services.
  const targets = [
    { stage: "candidate", id: candidateServiceId },
    { stage: "production", id: productionServiceId },
  ];
  const inspected = [];
  for (const target of targets) {
    const expectedName = EXPECTED_SERVICES[target.stage].name;
    inspected.push({
      ...target,
      expectedName,
      ...(await inspectService(fetchImpl, apiKey, target.id, workspaceId, expectedName, apiBase)),
    });
  }

  // Keep the test transport injectable without changing the production endpoint.
  const put = async (method, path, body) => {
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw safeError(method, path, response.status);
    return response.json();
  };
  const configured = [];
  for (const target of inspected) {
    const changes = [];
    if (!target.headersComplete) {
      await put("PUT", requestPath(target.id, "headers"), REQUIRED_HEADER_RULES);
      changes.push("headers");
    }
    if (!target.routesComplete) {
      await put("PUT", requestPath(target.id, "routes"), REQUIRED_ROUTE_RULES);
      changes.push("routes");
    }
    const confirmed = await inspectService(
      fetchImpl,
      apiKey,
      target.id,
      workspaceId,
      target.expectedName,
      apiBase,
    );
    if (!confirmed.headersComplete || !confirmed.routesComplete)
      throw new Error(`Render ${target.stage} service did not confirm the required configuration`);
    configured.push({
      stage: target.stage,
      service_id: target.id,
      service_name: target.expectedName,
      changed: changes,
      headers: REQUIRED_HEADER_RULES,
      routes: REQUIRED_ROUTE_RULES,
    });
    log(
      `Render Static ${target.stage} service ${target.id}: configuration verified (${changes.join(", ") || "already configured"}).`,
    );
  }
  return { provider: "render-static", workspace_id: workspaceId, services: configured };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--"))
      throw new Error(`Invalid option near ${key ?? "end of arguments"}`);
    options[key.slice(2)] = value;
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  const result = await applyRenderStaticConfig({
    apiKey: process.env.RENDER_API_KEY,
    workspaceId: options["workspace-id"] ?? process.env.RENDER_WORKSPACE_ID,
    candidateServiceId: options["candidate-service-id"] ?? process.env.RENDER_CANDIDATE_SERVICE_ID,
    productionServiceId:
      options["production-service-id"] ?? process.env.RENDER_PRODUCTION_SERVICE_ID,
    log: (message) => console.log(message),
  });
  console.log(
    `Render Static configuration verified for ${result.services.length} approved services.`,
  );
}
