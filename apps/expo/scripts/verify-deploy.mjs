#!/usr/bin/env node
/**
 * Proves the production alias is actually serving the build we just exported.
 *
 * `eas deploy --prod` reports "Promoted deployment to production" the moment
 * the alias is repointed, but https://get-your-fit.expo.app serves its
 * index.html through an edge cache with `cache-control: max-age=3600`. Until
 * that entry expires, production keeps handing out the previous document -
 * which references the previous bundle. The deploy succeeded and the site
 * still shows the old app, with nothing in the deploy output saying so.
 *
 * So compare the entry filename in the local export against the one the
 * production URL is really serving, and say plainly which build is live.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PRODUCTION_URL = "https://get-your-fit.expo.app";
const ATTEMPTS = 6;
const INTERVAL_MS = 10_000;
const DEPLOYMENT_PROBE_PATH = "/__deployment";
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

async function liveState(productionUrl) {
  // Cache-bust the request itself, or we measure our own cached response
  // rather than what the edge holds for real visitors.
  const response = await fetch(`${productionUrl}/?deploy-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${productionUrl} returned ${response.status}`);

  const missingHeaders = Object.entries(REQUIRED_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  );
  if (missingHeaders.length > 0) {
    const detail = missingHeaders
      .map(
        ([name, value]) => `${name}=${response.headers.get(name) ?? "missing"} (expected ${value})`,
      )
      .join(", ");
    throw new Error(`${productionUrl} is missing required security headers: ${detail}`);
  }

  return {
    entryBundle: /entry-[a-f0-9]+\.js/.exec(await response.text())?.[0] ?? null,
    headers: Object.fromEntries(
      Object.keys(REQUIRED_HEADERS).map((name) => [name, response.headers.get(name) ?? null]),
    ),
  };
}

async function probeDeploymentBinding(productionUrl) {
  const response = await fetch(`${productionUrl}${DEPLOYMENT_PROBE_PATH}?deploy-check=${Date.now()}`, {
    headers: {
      "cache-control": "no-cache",
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`${productionUrl}${DEPLOYMENT_PROBE_PATH} returned ${response.status}`);
  }
  const payload = await response.json();
  if (typeof payload?.requestUrl !== "string") {
    throw new Error("Deployment probe response is missing requestUrl");
  }
  return payload;
}

function deploymentFromLog(logText) {
  const matches = [...logText.matchAll(/https:\/\/[a-z0-9-]+--([a-z0-9]+)\.expo\.app\/?/gi)];
  if (matches.length === 0) {
    throw new Error("Deploy log is missing the immutable deployment URL");
  }
  return {
    deploymentId: matches.at(-1)[1],
    deploymentUrl: matches.at(-1)[0],
  };
}

function deploymentFromRequestUrl(requestUrl) {
  const hostname = new URL(requestUrl).hostname;
  const match = /^[a-z0-9-]+--([a-z0-9]+)\.expo\.app$/i.exec(hostname);
  if (!match) {
    throw new Error(`Deployment probe requestUrl does not contain an immutable deployment hostname: ${requestUrl}`);
  }
  return {
    deploymentId: match[1],
    deploymentUrl: `https://${hostname}/`,
  };
}

const options = parseArgs(process.argv.slice(2));
const expected = localEntry();
const deployLogPath = options["deploy-log"];
const evidenceFile = options["evidence-file"];
const productionUrl = options["production-url"] ?? DEFAULT_PRODUCTION_URL;
const attempts = Number.parseInt(options["attempts"] ?? `${ATTEMPTS}`, 10);
const intervalMs = Number.parseInt(options["interval-ms"] ?? `${INTERVAL_MS}`, 10);
const deployment =
  deployLogPath == null
    ? { deploymentId: null, deploymentUrl: null }
    : deploymentFromLog(readFileSync(deployLogPath, "utf8"));

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  let live = null;
  let binding = null;
  try {
    live = await liveState(productionUrl);
    binding = await probeDeploymentBinding(productionUrl);
  } catch (error) {
    // A transient edge blip must not fail the whole deploy; keep polling.
    console.warn(`verify-deploy: attempt ${attempt} could not read production - ${error.message}`);
  }

  const liveDeployment =
    binding == null ? null : deploymentFromRequestUrl(binding.requestUrl);

  if (
    live?.entryBundle === expected &&
    liveDeployment?.deploymentId === deployment.deploymentId &&
    liveDeployment?.deploymentUrl === deployment.deploymentUrl
  ) {
    if (evidenceFile) {
      writeFileSync(
        evidenceFile,
        `${JSON.stringify(
          {
            verified_at: new Date().toISOString(),
            production_url: productionUrl,
            expected_entry_bundle: expected,
            live_entry_bundle: live.entryBundle,
            live_deployment_id: liveDeployment.deploymentId,
            live_deployment_url: liveDeployment.deploymentUrl,
            expected_deployment_id: deployment.deploymentId,
            expected_deployment_url: deployment.deploymentUrl,
            alias_request_url: binding.requestUrl,
            alias_origin: binding.origin ?? null,
            alias_forwarded_host: binding.forwardedHost ?? null,
            headers: live.headers,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }
    console.log(`verify-deploy: production is serving this build (${expected}).`);
    process.exit(0);
  }

  if (attempt < attempts) {
    const liveDeploymentId =
      binding == null ? "unknown" : deploymentFromRequestUrl(binding.requestUrl).deploymentId;
    console.log(
      `verify-deploy: production still on ${live?.entryBundle ?? "unknown"} from deployment ${liveDeploymentId}, waiting...`,
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

console.error(
  [
    "",
    "verify-deploy: the deploy succeeded but production has NOT picked it up yet.",
    `  expected: ${expected}`,
    `  serving:  ${(await liveState(productionUrl).then((state) => state.entryBundle).catch(() => null)) ?? "unknown"}`,
    `  live ID:   ${
      (await probeDeploymentBinding(productionUrl)
        .then((payload) => deploymentFromRequestUrl(payload.requestUrl).deploymentId)
        .catch(() => null)) ?? "unknown"
    }`,
    `  wanted ID: ${deployment.deploymentId ?? "unknown"}`,
    "",
    "The edge caches index.html for up to an hour (cache-control: max-age=3600).",
    "The production alias must serve the expected immutable bundle and all required",
    "security headers from the exact immutable deployment ID before this deployment",
    "is accepted as a rollback artifact.",
    "The build is live and correct on its own deployment URL right now - use that",
    "to review, or wait for the alias to expire. Nothing needs redeploying.",
    "",
  ].join("\n"),
);
process.exit(1);
