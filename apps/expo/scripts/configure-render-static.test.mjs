import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRenderStaticConfig,
  providerRequestBody,
  REQUIRED_HEADER_RULES,
  REQUIRED_ROUTE_RULES,
} from "./configure-render-static.mjs";

const API_KEY = "render-secret-that-must-not-be-logged";
const WORKSPACE = "tea-d8p3vu5ckfvc73a025h0";
const TARGETS = {
  "srv-d9li80ijnfac73ajo9u0": "gyf-expo-web-candidate",
  "srv-d9lim33m8hqs738qfsa0": "gyf-expo-web",
};

function fakeRenderApi({ failurePath } = {}) {
  const calls = [];
  const state = new Map(
    Object.entries(TARGETS).map(([id, name]) => [
      id,
      {
        id,
        name,
        ownerId: WORKSPACE,
        type: "static_site",
        headers: [REQUIRED_HEADER_RULES[3]],
        routes: [],
      },
    ]),
  );
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const method = init.method ?? "GET";
    calls.push({
      method,
      path,
      body: init.body ? JSON.parse(init.body) : undefined,
      headers: init.headers,
    });
    if (failurePath === `${method} ${path}`)
      return new Response("provider failure", { status: 503 });
    const serviceId = path.match(/^\/v1\/services\/([^/]+)/)?.[1];
    const service = serviceId && state.get(serviceId);
    if (!service) return new Response(JSON.stringify({ message: "missing" }), { status: 404 });
    if (path.endsWith("/headers")) {
      if (method === "PUT") service.headers = JSON.parse(init.body);
      return Response.json(
        service.headers.map((header, index) => ({ ...header, id: `header-${index}` })),
      );
    }
    if (path.endsWith("/routes")) {
      if (method === "PUT") service.routes = JSON.parse(init.body);
      return Response.json(
        service.routes.map((route, index) => ({
          route: { ...route, id: `route-${index}`, priority: index },
          cursor: String(index),
        })),
      );
    }
    return Response.json(service);
  };
  return { calls, state, fetchImpl };
}

test("provider request bodies are the checked-in security headers and deployment rewrite", () => {
  const body = providerRequestBody();
  assert.deepEqual(body.headers, REQUIRED_HEADER_RULES);
  assert.deepEqual(body.routes, REQUIRED_ROUTE_RULES);
  assert.equal(
    body.headers.some((rule) => rule.name === "X-Frame-Options" && rule.value === "DENY"),
    true,
  );
  assert.deepEqual(
    body.headers.find((rule) => rule.path === "/" && rule.name === "Cache-Control"),
    { path: "/", name: "Cache-Control", value: "no-cache" },
  );
  assert.deepEqual(body.routes, [
    { type: "rewrite", source: "/__deployment/api", destination: "/__deployment/api.json" },
  ]);
});

test("both approved services are configured with no secret in the request body or logs", async () => {
  const api = fakeRenderApi();
  const logs = [];
  const result = await applyRenderStaticConfig({
    apiKey: API_KEY,
    workspaceId: WORKSPACE,
    candidateServiceId: "srv-d9li80ijnfac73ajo9u0",
    productionServiceId: "srv-d9lim33m8hqs738qfsa0",
    apiBase: "https://render.test/v1",
    fetchImpl: api.fetchImpl,
    log: (message) => logs.push(message),
  });
  assert.deepEqual(
    result.services.map((service) => service.service_id),
    Object.keys(TARGETS),
  );
  const puts = api.calls.filter((call) => call.method === "PUT");
  assert.equal(puts.length, 4);
  assert.deepEqual(puts[0].body, REQUIRED_HEADER_RULES);
  assert.deepEqual(puts[1].body, REQUIRED_ROUTE_RULES);
  assert.deepEqual(puts[2].body, REQUIRED_HEADER_RULES);
  assert.deepEqual(puts[3].body, REQUIRED_ROUTE_RULES);
  assert.ok(
    api.calls.every(
      (call) => call.body === undefined || !JSON.stringify(call.body).includes(API_KEY),
    ),
  );
  assert.ok(logs.every((message) => !message.includes(API_KEY)));
});

test("a second application is idempotent and performs no provider writes", async () => {
  const api = fakeRenderApi();
  const options = {
    apiKey: API_KEY,
    workspaceId: WORKSPACE,
    candidateServiceId: "srv-d9li80ijnfac73ajo9u0",
    productionServiceId: "srv-d9lim33m8hqs738qfsa0",
    apiBase: "https://render.test/v1",
    fetchImpl: api.fetchImpl,
  };
  await applyRenderStaticConfig(options);
  const callsAfterFirst = api.calls.length;
  const result = await applyRenderStaticConfig(options);
  assert.deepEqual(
    result.services.map((service) => service.changed),
    [[], []],
  );
  assert.equal(
    api.calls.slice(callsAfterFirst).some((call) => call.method === "PUT"),
    false,
  );
});

test("configuration refuses an unapproved service before any mutation", async () => {
  const api = fakeRenderApi();
  await assert.rejects(
    applyRenderStaticConfig({
      apiKey: API_KEY,
      workspaceId: "wrong-workspace",
      candidateServiceId: "srv-d9li80ijnfac73ajo9u0",
      productionServiceId: "srv-d9lim33m8hqs738qfsa0",
      apiBase: "https://render.test/v1",
      fetchImpl: api.fetchImpl,
    }),
    /approved Render workspace/,
  );
  assert.equal(
    api.calls.some((call) => call.method === "PUT"),
    false,
  );
});

test("configuration refuses same-named duplicate service IDs before provider access", async () => {
  const api = fakeRenderApi();
  await assert.rejects(
    applyRenderStaticConfig({
      apiKey: API_KEY,
      workspaceId: WORKSPACE,
      candidateServiceId: "srv-duplicate-candidate",
      productionServiceId: "srv-d9lim33m8hqs738qfsa0",
      apiBase: "https://render.test/v1",
      fetchImpl: api.fetchImpl,
    }),
    /approved existing candidate service/,
  );
  assert.equal(api.calls.length, 0);
});

test("CD configures both services before any candidate or production deploy", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/cd.yml", import.meta.url),
    "utf8",
  );
  const configure = workflow.indexOf("Configure Render Static headers and identity rewrite");
  const candidateDeploy = workflow.indexOf("Deploy isolated Render candidate");
  const productionDeploy = workflow.indexOf(
    'render deploys create "$RENDER_PRODUCTION_SERVICE_ID"',
  );
  assert.ok(configure >= 0 && configure < candidateDeploy && configure < productionDeploy);
  assert.match(workflow, /validate-render-environment\.mjs/);
  const environmentValidator = readFileSync(
    new URL("./validate-render-environment.mjs", import.meta.url),
    "utf8",
  );
  assert.match(environmentValidator, /https:\/\/gyf-expo-web-candidate\.onrender\.com/);
  assert.match(environmentValidator, /https:\/\/gyf-expo-web\.onrender\.com/);
  assert.match(environmentValidator, /https:\/\/app\.getyourfit\.co/);
});

test("a provider failure rejects configuration, so CD cannot reach deployment", async () => {
  const api = fakeRenderApi({
    failurePath: "PUT /v1/services/srv-d9lim33m8hqs738qfsa0/routes",
  });
  await assert.rejects(
    applyRenderStaticConfig({
      apiKey: API_KEY,
      workspaceId: WORKSPACE,
      candidateServiceId: "srv-d9li80ijnfac73ajo9u0",
      productionServiceId: "srv-d9lim33m8hqs738qfsa0",
      apiBase: "https://render.test/v1",
      fetchImpl: api.fetchImpl,
    }),
    /failed with HTTP 503/,
  );
  assert.equal(
    api.calls.some(
      (call) => call.method === "PUT" && call.path.includes("srv-d9lim33m8hqs738qfsa0"),
    ),
    true,
  );
});
