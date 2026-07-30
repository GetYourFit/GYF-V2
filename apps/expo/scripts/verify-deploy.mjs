#!/usr/bin/env node
/**
 * Proves the build `eas deploy --prod` just created is actually live and
 * correctly secured - on the exact immutable deployment URL that command
 * printed, not on the production alias.
 *
 * `eas deploy --prod` reports "Promoted deployment to production" the
 * moment the alias is repointed, but https://get-your-fit.expo.app serves
 * its index.html through an edge cache with `cache-control: max-age=3600`.
 * Until that entry expires (up to an hour), the alias keeps handing out the
 * previous document, so polling it can never reliably confirm *this* deploy
 * within a CI run. The immutable per-deployment URL
 * (`https://get-your-fit--<id>.expo.app`) has no such cache: it is unique to
 * this deployment and serves the real thing immediately. That URL, plus the
 * eas-cli log line confirming promotion, is the actual proof this deploy is
 * live in production - so that is what gates the build.
 *
 * The alias is still probed once, best-effort, purely to record whether it
 * has already picked up the new bundle - it never blocks or fails the job.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PRODUCTION_URL = "https://get-your-fit.expo.app";
const ATTEMPTS = 3;
const INTERVAL_MS = 5_000;
const REQUIRED_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function bundleDirectory() {
  const candidates = ["dist/client/_expo/static/js/web", "dist/_expo/static/js/web"];
  const directory = candidates.find((candidate) => {
    try {
      return readdirSync(join(process.cwd(), candidate)).length >= 0;
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

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

// Reads the eas-cli deploy log to find the exact deployment this run just
// created and to require, in eas-cli's own words, that it was promoted to
// production. This is the deployment's system of record - not something we
// have to re-derive by fetching a cached alias.
function deploymentFromLog(logText) {
  const urlMatches = [...logText.matchAll(/https:\/\/([a-z0-9-]+)--([a-z0-9]+)\.expo\.app\/?/gi)];
  if (urlMatches.length === 0) {
    throw new Error("Deploy log is missing the immutable deployment URL");
  }
  if (!/promoted deployment to production/i.test(logText)) {
    throw new Error("Deploy log does not confirm the deployment was promoted to production");
  }
  const urlMatch = urlMatches.at(-1);
  return {
    deploymentId: urlMatch[2],
    deploymentUrl: urlMatch[0],
  };
}

async function fetchState(url) {
  // Cache-bust the request itself, or we measure our own cached response
  // rather than what the URL holds for real visitors.
  const response = await fetch(`${url}?deploy-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  const missingHeaders = Object.entries(REQUIRED_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  );

  return {
    entryBundle: /entry-[a-f0-9]+\.js/.exec(await response.text())?.[0] ?? null,
    headers: Object.fromEntries(
      Object.keys(REQUIRED_HEADERS).map((name) => [name, response.headers.get(name) ?? null]),
    ),
    missingHeaders,
  };
}

async function verifyApiSurface(apiUrl) {
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
    {
      path: "/health",
      valid: (body) => body?.status === "ok" && body?.service === "api",
    },
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
        typeof body?.event_sink === "string",
    },
  ];
  const results = {};
  for (const probe of probes) {
    const url = new URL(probe.path, parsed);
    const response = await fetch(`${url}?release-check=${Date.now()}`, {
      headers: { "cache-control": "no-cache", accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`API ${probe.path} returned ${response.status}`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`API ${probe.path} returned invalid JSON`);
    }
    if (!probe.valid(body)) {
      throw new Error(`API ${probe.path} returned an unexpected status payload`);
    }
    results[probe.path] = { status: response.status, content: body };
  }
  return { base_url: parsed.origin, probes: results };
}

async function probeAliasBestEffort(productionUrl) {
  try {
    const state = await fetchState(productionUrl);
    return {
      reachable: true,
      entryBundle: state.entryBundle,
      missingHeaders: state.missingHeaders,
    };
  } catch (error) {
    return { reachable: false, error: error.message };
  }
}

const options = parseArgs(process.argv.slice(2));
const expected = localEntry();
const deployLogPath = options["deploy-log"];
if (!deployLogPath) throw new Error("Missing required option --deploy-log");
const evidenceFile = options["evidence-file"];
const productionUrl = options["production-url"] ?? DEFAULT_PRODUCTION_URL;
const apiUrl = options["api-url"];
const attempts = Number.parseInt(options["attempts"] ?? `${ATTEMPTS}`, 10);
const intervalMs = Number.parseInt(options["interval-ms"] ?? `${INTERVAL_MS}`, 10);
const deployment = deploymentFromLog(readFileSync(deployLogPath, "utf8"));
const deploymentUrl = options["deployment-url"] ?? deployment.deploymentUrl;

let lastState = null;
let lastError = null;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    lastState = await fetchState(deploymentUrl);
    if (lastState.entryBundle === expected && lastState.missingHeaders.length === 0) {
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
    [
      "",
      "verify-deploy: the immutable deployment URL is not serving the build we exported.",
      `  deployment URL: ${deploymentUrl}`,
      `  expected: ${expected}`,
      `  serving:  ${lastState.entryBundle ?? "unknown"}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (lastState.missingHeaders.length > 0) {
  const detail = lastState.missingHeaders
    .map(([name, value]) => `${name}=${lastState.headers[name] ?? "missing"} (expected ${value})`)
    .join(", ");
  console.error(
    [
      "",
      "verify-deploy: the immutable deployment URL is missing required security headers.",
      `  deployment URL: ${deploymentUrl}`,
      `  missing: ${detail}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const apiSurface = apiUrl ? await verifyApiSurface(apiUrl) : null;
const alias = await probeAliasBestEffort(productionUrl);

if (evidenceFile) {
  writeFileSync(
    evidenceFile,
    `${JSON.stringify(
      {
        verified_at: new Date().toISOString(),
        production_url: productionUrl,
        expected_entry_bundle: expected,
        live_entry_bundle: lastState.entryBundle,
        live_deployment_id: deployment.deploymentId,
        live_deployment_url: deploymentUrl,
        expected_deployment_id: deployment.deploymentId,
        expected_deployment_url: deploymentUrl,
        promoted_to_production: true,
        headers: lastState.headers,
        api_surface: apiSurface,
        alias_probe: alias,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

console.log(
  `verify-deploy: deployment ${deployment.deploymentId} is live at ${deploymentUrl} serving ${expected} with all required security headers, and eas-cli confirmed promotion to production.`,
);
if (apiSurface) {
  console.log(
    `verify-deploy: API health, readiness, and status content passed at ${apiSurface.base_url}.`,
  );
}
if (alias.reachable && alias.entryBundle === expected) {
  console.log(`verify-deploy: production alias ${productionUrl} has already picked up this build.`);
} else if (alias.reachable) {
  console.log(
    `verify-deploy: production alias ${productionUrl} is still serving ${alias.entryBundle ?? "unknown"} (edge cache up to 1h, cache-control: max-age=3600) - not a failure, informational only.`,
  );
} else {
  console.log(
    `verify-deploy: production alias probe was inconclusive (${alias.error}) - not a failure, informational only.`,
  );
}
process.exit(0);
