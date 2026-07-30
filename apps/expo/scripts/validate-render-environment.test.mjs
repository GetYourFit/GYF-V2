import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_RENDER_CONFIGURATION,
  REQUIRED_RENDER_ENVIRONMENT,
  validateRenderEnvironment,
} from "./validate-render-environment.mjs";

const VALID_ENVIRONMENT = {
  RENDER_PRODUCTION_ENABLED: "true",
  RENDER_API_KEY: "render-secret",
  RENDER_WORKSPACE_ID: APPROVED_RENDER_CONFIGURATION.workspaceId,
  RENDER_CANDIDATE_SERVICE_ID: APPROVED_RENDER_CONFIGURATION.candidateServiceId,
  RENDER_PRODUCTION_SERVICE_ID: APPROVED_RENDER_CONFIGURATION.productionServiceId,
  RENDER_CANDIDATE_URL: APPROVED_RENDER_CONFIGURATION.candidateUrl,
  RENDER_PRODUCTION_URL: APPROVED_RENDER_CONFIGURATION.productionUrl,
  RENDER_CANONICAL_URL: APPROVED_RENDER_CONFIGURATION.canonicalUrl,
  EXPO_PUBLIC_API_URL: "https://gyf-api-va.onrender.com",
  EXPO_PUBLIC_SUPABASE_URL: "https://tabjvaatrikogutkrjom.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test-key",
  GYF_E2E_EMAIL: "render-e2e@example.test",
  GYF_E2E_PASSWORD: "safe-test-password",
};

function environment(overrides = {}) {
  return { ...VALID_ENVIRONMENT, ...overrides };
}

test("validates the complete approved Render release environment without returning secrets", () => {
  const result = validateRenderEnvironment(environment());
  assert.equal(result.workspace_id, APPROVED_RENDER_CONFIGURATION.workspaceId);
  assert.equal(result.authenticated_test_account_configured, true);
  assert.equal(JSON.stringify(result).includes("render-secret"), false);
  assert.equal(JSON.stringify(result).includes("safe-test-password"), false);
});

test("rejects every missing environment value before provider access", () => {
  for (const name of REQUIRED_RENDER_ENVIRONMENT) {
    assert.throws(
      () => validateRenderEnvironment(environment({ [name]: "" })),
      new RegExp(name),
      `expected missing ${name} to fail closed`,
    );
  }
});

test("rejects disabled Render ownership switch", () => {
  assert.throws(
    () => validateRenderEnvironment(environment({ RENDER_PRODUCTION_ENABLED: "false" })),
    /RENDER_PRODUCTION_ENABLED.*exactly true/,
  );
});

test("rejects unapproved workspace and service identities", () => {
  for (const name of [
    "RENDER_WORKSPACE_ID",
    "RENDER_CANDIDATE_SERVICE_ID",
    "RENDER_PRODUCTION_SERVICE_ID",
  ]) {
    assert.throws(
      () => validateRenderEnvironment(environment({ [name]: "unapproved" })),
      new RegExp(`${name}.*approved`),
    );
  }
  assert.throws(
    () =>
      validateRenderEnvironment(
        environment({
          RENDER_CANDIDATE_SERVICE_ID: VALID_ENVIRONMENT.RENDER_PRODUCTION_SERVICE_ID,
        }),
      ),
    /must differ/,
  );
});

test("rejects non-canonical or malformed Render URLs", () => {
  for (const name of ["RENDER_CANDIDATE_URL", "RENDER_PRODUCTION_URL", "RENDER_CANONICAL_URL"]) {
    assert.throws(
      () => validateRenderEnvironment(environment({ [name]: "https://other.example.test" })),
      new RegExp(`${name}.*approved`),
    );
  }
  assert.throws(
    () =>
      validateRenderEnvironment(environment({ RENDER_CANONICAL_URL: "http://app.getyourfit.co" })),
    /RENDER_CANONICAL_URL.*approved/,
  );
  assert.throws(
    () => validateRenderEnvironment(environment({ EXPO_PUBLIC_API_URL: "not-a-url" })),
    /EXPO_PUBLIC_API_URL.*HTTPS/,
  );
  assert.throws(
    () =>
      validateRenderEnvironment(environment({ EXPO_PUBLIC_SUPABASE_URL: "http://supabase.test" })),
    /EXPO_PUBLIC_SUPABASE_URL.*HTTPS/,
  );
});

test("rejects invalid public Supabase credentials and authenticated test-account values", () => {
  assert.throws(
    () =>
      validateRenderEnvironment(
        environment({ EXPO_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9" }),
      ),
    /publishable key/,
  );
  assert.throws(
    () => validateRenderEnvironment(environment({ EXPO_PUBLIC_SUPABASE_ANON_KEY: "legacy-key" })),
    /publishable key/,
  );
  assert.throws(
    () => validateRenderEnvironment(environment({ GYF_E2E_EMAIL: "not-an-email" })),
    /GYF_E2E_EMAIL.*valid/,
  );
  assert.throws(
    () => validateRenderEnvironment(environment({ GYF_E2E_PASSWORD: "short" })),
    /GYF_E2E_PASSWORD.*invalid/,
  );
});
