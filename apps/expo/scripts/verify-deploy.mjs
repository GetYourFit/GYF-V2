#!/usr/bin/env node
/**
 * Verify a newly-created, non-production EAS deployment before any alias change.
 *
 * The release transaction is deliberately split into two commands:
 *   1. `eas deploy --non-interactive` creates an immutable preview deployment.
 *   2. this verifier proves that deployment, then `eas deploy:alias --prod` promotes it.
 *
 * A deploy log containing a promotion line is rejected here. That makes it impossible
 * for this verifier to bless the old `eas deploy --prod` ordering by accident.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const DEFAULT_PRODUCTION_URL = "https://get-your-fit.expo.app";
const ATTEMPTS = 3;
const INTERVAL_MS = 5_000;
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const REQUIRED_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
const CUELINKS_CID = "305057";
const CUELINKS_VENDOR_LOADER = `var cId =  "${CUELINKS_CID}";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());`;
const CUELINKS_EXACT_LOADER = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="${CUELINKS_CID}">${CUELINKS_VENDOR_LOADER}</script>`;
const CUELINKS_SDK_PATTERN =
  /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*cuelinksv2\.js(?:\?[^"']*)?["'])(?![^>]*\btype\s*=\s*["']application\/(?:json|ld\+json)["'])[^>]*>\s*<\/script>/gi;

function bundleDirectory() {
  const candidates = ["dist/client/_expo/static/js/web", "dist/_expo/static/js/web"];
  const directory = candidates.find((candidate) => {
    try {
      readdirSync(join(process.cwd(), candidate));
      return true;
    } catch {
      return false;
    }
  });
  if (!directory) {
    throw new Error(`No JS bundle directory found in ${candidates.join(" or ")}`);
  }
  return directory;
}

function localEntry() {
  const files = readdirSync(join(process.cwd(), bundleDirectory()));
  const entry = files.find((file) => file.startsWith("entry-") && file.endsWith(".js"));
  if (!entry) throw new Error("No entry bundle in exported web bundle - did the export run?");
  return entry;
}

function entryHash(entryBundle) {
  const match = /^entry-([a-f0-9]+)\.js$/.exec(basename(entryBundle));
  if (!match) throw new Error(`Invalid entry bundle name: ${entryBundle}`);
  return match[1];
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return options;
}

function deploymentFromLog(logText) {
  if (/promoted deployment to production/i.test(logText)) {
    throw new Error(
      "Deploy log already confirms production promotion; verification must run before promotion",
    );
  }
  const urlMatches = [...logText.matchAll(/https:\/\/([a-z0-9-]+)--([a-z0-9]+)\.expo\.app\/?/gi)];
  if (urlMatches.length === 0) {
    throw new Error("Deploy log is missing the immutable non-production deployment URL");
  }
  const urlMatch = urlMatches.at(-1);
  return {
    deploymentId: urlMatch[2],
    deploymentUrl: urlMatch[0],
  };
}

function promotionFromLog(logText, deploymentId) {
  if (!/promoted deployment to production/i.test(logText)) {
    throw new Error("Promotion log does not confirm the deployment was promoted to production");
  }
  return {
    confirmed: true,
    deployment_id: deploymentId,
    message: "Promoted deployment to production",
  };
}

function inspectCuelinks(html) {
  const exactLoaderCount = html.split(CUELINKS_EXACT_LOADER).length - 1;
  const sdkReferenceCount = (html.match(CUELINKS_SDK_PATTERN) ?? []).length;
  return {
    cid: CUELINKS_CID,
    exact_loader_count: exactLoaderCount,
    executable_sdk_reference_count: sdkReferenceCount,
    valid: exactLoaderCount === 1 && exactLoaderCount + sdkReferenceCount === 1,
  };
}

function readCuelinksEvidence(path) {
  if (!path) return null;
  const evidence = JSON.parse(readFileSync(path, "utf8"));
  if (evidence.cid !== CUELINKS_CID || evidence.valid !== true) {
    throw new Error("Cuelinks export evidence is missing the exact verified loader");
  }
  return evidence;
}

async function fetchState(url) {
  const response = await fetch(`${url}?deploy-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const html = await response.text();
  const missingHeaders = Object.entries(REQUIRED_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  );
  return {
    entryBundle: /entry-[a-f0-9]+\.js/.exec(html)?.[0] ?? null,
    headers: Object.fromEntries(
      Object.keys(REQUIRED_HEADERS).map((name) => [name, response.headers.get(name) ?? null]),
    ),
    missingHeaders,
    cuelinks: inspectCuelinks(html),
  };
}

async function fetchDeploymentIdentity(url, expectedSourceSha, expectedDeploymentId) {
  if (!expectedSourceSha) return null;
  const identityUrl = new URL("/__deployment", url);
  const response = await fetch(`${identityUrl}?release-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache", accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Deployment identity returned ${response.status}`);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Deployment identity returned invalid JSON");
  }
  if (body.release_sha !== expectedSourceSha) {
    throw new Error(
      `Immutable deployment identity source SHA ${body.release_sha ?? "unknown"} does not match ${expectedSourceSha}`,
    );
  }
  if (body.deployment_id && body.deployment_id !== expectedDeploymentId) {
    throw new Error(
      `Immutable deployment identity ID ${body.deployment_id} does not match ${expectedDeploymentId}`,
    );
  }
  return body;
}

async function verifyApiSurface(apiUrl, expectedSourceSha) {
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error(`API surface URL is invalid: ${apiUrl}`);
  }
  if (parsed.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`API surface URL must use HTTPS: ${apiUrl}`);
  }
  const probes = [
    { path: "/health", valid: (body) => body?.status === "ok" && body?.service === "api" },
    {
      path: "/ready",
      valid: (body) => body?.status === "ready" && body?.checks?.database === true,
    },
    {
      path: "/system/status",
      valid: (body) =>
        typeof body?.environment === "string" &&
        typeof body?.database === "string" &&
        typeof body?.capabilities === "object" &&
        typeof body?.event_sink === "string" &&
        typeof body?.release_sha === "string",
    },
  ];
  const results = {};
  for (const probe of probes) {
    const url = new URL(probe.path, parsed);
    const response = await fetch(`${url}?release-check=${Date.now()}`, {
      headers: { "cache-control": "no-cache", accept: "application/json" },
    });
    if (!response.ok) throw new Error(`API ${probe.path} returned ${response.status}`);
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`API ${probe.path} returned invalid JSON`);
    }
    if (!probe.valid(body))
      throw new Error(`API ${probe.path} returned an unexpected status payload`);
    if (
      probe.path === "/system/status" &&
      expectedSourceSha &&
      body.release_sha !== expectedSourceSha
    ) {
      throw new Error(
        `API release SHA ${body.release_sha} does not match source SHA ${expectedSourceSha}`,
      );
    }
    results[probe.path] = { status: response.status, content: body };
  }
  return {
    base_url: parsed.origin,
    release_sha: results["/system/status"].content.release_sha,
    probes: results,
  };
}

async function probeAliasBestEffort(productionUrl) {
  try {
    const state = await fetchState(productionUrl);
    return {
      reachable: true,
      entryBundle: state.entryBundle,
      missingHeaders: state.missingHeaders,
      cuelinks: state.cuelinks,
    };
  } catch (error) {
    return { reachable: false, error: error.message };
  }
}

const options = parseArgs(process.argv.slice(2));
const expected = localEntry();
const expectedHash = entryHash(expected);
const deployLogPath = options["deploy-log"];
if (!deployLogPath) throw new Error("Missing required option --deploy-log");
const evidenceFile = options["evidence-file"];
const productionUrl = options["production-url"] ?? DEFAULT_PRODUCTION_URL;
const apiUrl = options["api-url"];
const expectedSourceSha = options["expected-source-sha"];
if (expectedSourceSha && !RELEASE_SHA_PATTERN.test(expectedSourceSha)) {
  throw new Error(`Expected source SHA is malformed: ${expectedSourceSha}`);
}
const attempts = Number.parseInt(options["attempts"] ?? `${ATTEMPTS}`, 10);
const intervalMs = Number.parseInt(options["interval-ms"] ?? `${INTERVAL_MS}`, 10);
const deployment = deploymentFromLog(readFileSync(deployLogPath, "utf8"));
const deploymentUrl = options["deployment-url"] ?? deployment.deploymentUrl;
const cuelinksExport = readCuelinksEvidence(options["cuelinks-evidence"]);
const promotionLogPath = options["promotion-log"];
const promotion = promotionLogPath
  ? promotionFromLog(readFileSync(promotionLogPath, "utf8"), deployment.deploymentId)
  : { confirmed: false, deployment_id: deployment.deploymentId };

let lastState = null;
let lastError = null;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    lastState = await fetchState(deploymentUrl);
    if (
      lastState.entryBundle === expected &&
      lastState.missingHeaders.length === 0 &&
      lastState.cuelinks.valid
    ) {
      break;
    }
  } catch (error) {
    lastError = error;
    console.warn(
      `verify-deploy: attempt ${attempt} could not read ${deploymentUrl} - ${error.message}`,
    );
  }
  if (attempt < attempts) {
    console.log(
      `verify-deploy: ${deploymentUrl} not yet confirmed (entry=${lastState?.entryBundle ?? "unknown"}), retrying...`,
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (!lastState) {
  console.error(
    `\nverify-deploy: could not reach the immutable deployment URL at all.\n  ${deploymentUrl}\n  ${lastError?.message ?? "unknown error"}\n`,
  );
  process.exit(1);
}
if (lastState.entryBundle !== expected) {
  console.error(
    `\nverify-deploy: immutable deployment served ${lastState.entryBundle ?? "unknown"}; expected ${expected}.\n`,
  );
  process.exit(1);
}
if (lastState.missingHeaders.length > 0) {
  const detail = lastState.missingHeaders
    .map(([name, value]) => `${name}=${lastState.headers[name] ?? "missing"} (expected ${value})`)
    .join(", ");
  console.error(
    `\nverify-deploy: immutable deployment is missing required security headers: ${detail}\n`,
  );
  process.exit(1);
}
if (!lastState.cuelinks.valid) {
  console.error(
    `\nverify-deploy: immutable deployment has invalid Cuelinks evidence (exact=${lastState.cuelinks.exact_loader_count}, sdk=${lastState.cuelinks.executable_sdk_reference_count}).\n`,
  );
  process.exit(1);
}

const identity = await fetchDeploymentIdentity(
  deploymentUrl,
  expectedSourceSha,
  deployment.deploymentId,
);
const apiSurface = apiUrl ? await verifyApiSurface(apiUrl, expectedSourceSha) : null;
const alias = await probeAliasBestEffort(productionUrl);
const verifiedAt = new Date().toISOString();
const evidence = {
  schema_version: 2,
  verified_at: verifiedAt,
  verification_stage: promotion.confirmed ? "post-promotion" : "immutable-before-promotion",
  production_url: productionUrl,
  expected_source_sha: expectedSourceSha ?? null,
  expected_entry_bundle: expected,
  expected_entry_hash: expectedHash,
  live_entry_bundle: lastState.entryBundle,
  live_deployment_id: deployment.deploymentId,
  live_deployment_url: deploymentUrl,
  expected_deployment_id: deployment.deploymentId,
  expected_deployment_url: deploymentUrl,
  promoted_to_production: promotion.confirmed,
  promotion_attempted: promotion.confirmed,
  promotion,
  headers: lastState.headers,
  cuelinks: {
    export: cuelinksExport,
    immutable: lastState.cuelinks,
    alias_probe: alias.cuelinks ?? null,
  },
  deployment_identity: identity,
  api_surface: apiSurface,
  alias_probe: alias,
};
if (evidenceFile) writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(
  `verify-deploy: immutable deployment ${deployment.deploymentId} serves ${expected} with all required security headers and Cuelinks evidence; promotion=${promotion.confirmed}.`,
);
if (apiSurface)
  console.log(
    `verify-deploy: API release identity ${apiSurface.release_sha} and health probes passed.`,
  );
if (alias.reachable && alias.entryBundle === expected) {
  console.log(`verify-deploy: production alias ${productionUrl} has already picked up this build.`);
} else if (alias.reachable) {
  console.log(
    `verify-deploy: production alias ${productionUrl} is serving ${alias.entryBundle ?? "unknown"}; informational best-effort probe only.`,
  );
} else {
  console.log(
    `verify-deploy: production alias probe was inconclusive (${alias.error}); informational best-effort probe only.`,
  );
}
process.exit(0);
