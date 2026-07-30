#!/usr/bin/env node
/**
 * Validate the complete Render Static release environment without exposing secrets.
 *
 * This runs before any provider CLI/API operation. Keep the approved service IDs and
 * origins here so a partially configured GitHub environment cannot deploy elsewhere.
 */

export const REQUIRED_RENDER_ENVIRONMENT = [
  "RENDER_PRODUCTION_ENABLED",
  "RENDER_API_KEY",
  "RENDER_WORKSPACE_ID",
  "RENDER_CANDIDATE_SERVICE_ID",
  "RENDER_PRODUCTION_SERVICE_ID",
  "RENDER_CANDIDATE_URL",
  "RENDER_PRODUCTION_URL",
  "RENDER_CANONICAL_URL",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "GYF_E2E_EMAIL",
  "GYF_E2E_PASSWORD",
];

export const APPROVED_RENDER_CONFIGURATION = Object.freeze({
  workspaceId: "tea-d8p3vu5ckfvc73a025h0",
  candidateServiceId: "srv-d9li80ijnfac73ajo9u0",
  productionServiceId: "srv-d9lim33m8hqs738qfsa0",
  candidateUrl: "https://gyf-expo-web-candidate.onrender.com",
  productionUrl: "https://gyf-expo-web.onrender.com",
  canonicalUrl: "https://app.getyourfit.co",
});

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`${name} is not configured in the RENDER_PRODUCTION environment`);
  return value;
}

function httpsOrigin(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error(`${name} must be a valid HTTPS URL`);
  return parsed;
}

function exact(value, expected, name) {
  if (value !== expected) throw new Error(`${name} is not the approved Render value`);
}

export function validateRenderEnvironment(environment = process.env) {
  const values = Object.fromEntries(
    REQUIRED_RENDER_ENVIRONMENT.map((name) => [name, required(environment[name], name)]),
  );

  if (values.RENDER_PRODUCTION_ENABLED !== "true")
    throw new Error("RENDER_PRODUCTION_ENABLED must be exactly true for the Render release lane");
  if (values.RENDER_CANDIDATE_SERVICE_ID === values.RENDER_PRODUCTION_SERVICE_ID)
    throw new Error("RENDER_CANDIDATE_SERVICE_ID and RENDER_PRODUCTION_SERVICE_ID must differ");

  exact(
    values.RENDER_WORKSPACE_ID,
    APPROVED_RENDER_CONFIGURATION.workspaceId,
    "RENDER_WORKSPACE_ID",
  );
  exact(
    values.RENDER_CANDIDATE_SERVICE_ID,
    APPROVED_RENDER_CONFIGURATION.candidateServiceId,
    "RENDER_CANDIDATE_SERVICE_ID",
  );
  exact(
    values.RENDER_PRODUCTION_SERVICE_ID,
    APPROVED_RENDER_CONFIGURATION.productionServiceId,
    "RENDER_PRODUCTION_SERVICE_ID",
  );
  exact(
    values.RENDER_CANDIDATE_URL,
    APPROVED_RENDER_CONFIGURATION.candidateUrl,
    "RENDER_CANDIDATE_URL",
  );
  exact(
    values.RENDER_PRODUCTION_URL,
    APPROVED_RENDER_CONFIGURATION.productionUrl,
    "RENDER_PRODUCTION_URL",
  );
  exact(
    values.RENDER_CANONICAL_URL,
    APPROVED_RENDER_CONFIGURATION.canonicalUrl,
    "RENDER_CANONICAL_URL",
  );

  for (const name of [
    "RENDER_CANDIDATE_URL",
    "RENDER_PRODUCTION_URL",
    "RENDER_CANONICAL_URL",
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_SUPABASE_URL",
  ])
    httpsOrigin(values[name], name);

  if (!/^sb_publishable_.+$/.test(values.EXPO_PUBLIC_SUPABASE_ANON_KEY))
    throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY must be a Supabase publishable key");
  if (/^eyJhbGciOiJIUzI1Ni/.test(values.EXPO_PUBLIC_SUPABASE_ANON_KEY))
    throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY must not be a legacy Supabase JWT");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.GYF_E2E_EMAIL))
    throw new Error("GYF_E2E_EMAIL must be a valid disposable test-account email");
  if (values.GYF_E2E_PASSWORD.length < 6)
    throw new Error("GYF_E2E_PASSWORD is invalid for the authenticated release check");

  return {
    provider: "render-static",
    environment: "RENDER_PRODUCTION",
    workspace_id: values.RENDER_WORKSPACE_ID,
    candidate_service_id: values.RENDER_CANDIDATE_SERVICE_ID,
    production_service_id: values.RENDER_PRODUCTION_SERVICE_ID,
    candidate_url: values.RENDER_CANDIDATE_URL,
    production_url: values.RENDER_PRODUCTION_URL,
    canonical_url: values.RENDER_CANONICAL_URL,
    api_url: new URL(values.EXPO_PUBLIC_API_URL).origin,
    supabase_url: new URL(values.EXPO_PUBLIC_SUPABASE_URL).origin,
    authenticated_test_account_configured: true,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateRenderEnvironment();
  console.log(
    `Render release environment verified for ${result.candidate_url}, ${result.production_url}, and ${result.canonical_url}; authenticated test account configured.`,
  );
}
