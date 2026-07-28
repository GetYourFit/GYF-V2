#!/usr/bin/env node
/**
 * Proves the production alias is actually serving the build we just exported.
 *
 * `eas deploy --prod` reports "Promoted deployment to production" the moment
 * the alias is repointed, but https://get-your-fit.expo.app serves its
 * index.html through an edge cache with `cache-control: max-age=3600`. Until
 * that entry expires, production keeps handing out the previous document —
 * which references the previous bundle. The deploy succeeded and the site
 * still shows the old app, with nothing in the deploy output saying so.
 *
 * So compare the entry filename in the local export against the one the
 * production URL is really serving, and say plainly which build is live.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_URL = "https://get-your-fit.expo.app";
const BUNDLE_DIR = "dist/_expo/static/js/web";
const ATTEMPTS = 6;
const INTERVAL_MS = 10_000;
const REQUIRED_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function localEntry() {
  const files = readdirSync(join(process.cwd(), BUNDLE_DIR));
  const entry = files.find((file) => file.startsWith("entry-") && file.endsWith(".js"));
  if (!entry) throw new Error(`No entry bundle in ${BUNDLE_DIR} — did the export run?`);
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

async function liveState() {
  // Cache-bust the request itself, or we measure our own cached response
  // rather than what the edge holds for real visitors.
  const response = await fetch(`${PRODUCTION_URL}/?deploy-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${PRODUCTION_URL} returned ${response.status}`);

  const missingHeaders = Object.entries(REQUIRED_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  );
  if (missingHeaders.length > 0) {
    const detail = missingHeaders
      .map(
        ([name, value]) => `${name}=${response.headers.get(name) ?? "missing"} (expected ${value})`,
      )
      .join(", ");
    throw new Error(`${PRODUCTION_URL} is missing required security headers: ${detail}`);
  }

  return {
    entryBundle: /entry-[a-f0-9]+\.js/.exec(await response.text())?.[0] ?? null,
    headers: Object.fromEntries(
      Object.keys(REQUIRED_HEADERS).map((name) => [name, response.headers.get(name) ?? null]),
    ),
  };
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

const options = parseArgs(process.argv.slice(2));
const expected = localEntry();
const deployLogPath = options["deploy-log"];
const evidenceFile = options["evidence-file"];
const deployment =
  deployLogPath == null
    ? { deploymentId: null, deploymentUrl: null }
    : deploymentFromLog(readFileSync(deployLogPath, "utf8"));

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  let live = null;
  try {
    live = await liveState();
  } catch (error) {
    // A transient edge blip must not fail the whole deploy; keep polling.
    console.warn(`verify-deploy: attempt ${attempt} could not read production — ${error.message}`);
  }

  if (live?.entryBundle === expected) {
    if (evidenceFile) {
      writeFileSync(
        evidenceFile,
        `${JSON.stringify(
          {
            verified_at: new Date().toISOString(),
            production_url: PRODUCTION_URL,
            expected_entry_bundle: expected,
            live_entry_bundle: live.entryBundle,
            expected_deployment_id: deployment.deploymentId,
            expected_deployment_url: deployment.deploymentUrl,
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

  if (attempt < ATTEMPTS) {
    console.log(`verify-deploy: production still on ${live?.entryBundle ?? "unknown"}, waiting...`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

console.error(
  [
    "",
    "verify-deploy: the deploy succeeded but production has NOT picked it up yet.",
    `  expected: ${expected}`,
    `  serving:  ${(await liveState().then((state) => state.entryBundle).catch(() => null)) ?? "unknown"}`,
    "",
    "The edge caches index.html for up to an hour (cache-control: max-age=3600).",
    "The production alias must serve the expected immutable bundle and all required",
    "security headers before this deployment is accepted as a rollback artifact.",
    "The build is live and correct on its own deployment URL right now — use that",
    "to review, or wait for the alias to expire. Nothing needs redeploying.",
    "",
  ].join("\n"),
);
process.exit(1);
