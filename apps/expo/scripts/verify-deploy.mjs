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
import { readdirSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_URL = "https://get-your-fit.expo.app";
const BUNDLE_DIR = "dist/_expo/static/js/web";
const ATTEMPTS = 6;
const INTERVAL_MS = 10_000;

function localEntry() {
  const files = readdirSync(join(process.cwd(), BUNDLE_DIR));
  const entry = files.find((file) => file.startsWith("entry-") && file.endsWith(".js"));
  if (!entry) throw new Error(`No entry bundle in ${BUNDLE_DIR} — did the export run?`);
  return entry;
}

async function liveEntry() {
  // Cache-bust the request itself, or we measure our own cached response
  // rather than what the edge holds for real visitors.
  const response = await fetch(`${PRODUCTION_URL}/?deploy-check=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`${PRODUCTION_URL} returned ${response.status}`);
  return /entry-[a-f0-9]+\.js/.exec(await response.text())?.[0] ?? null;
}

const expected = localEntry();

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  let live = null;
  try {
    live = await liveEntry();
  } catch (error) {
    // A transient edge blip must not fail the whole deploy; keep polling.
    console.warn(`verify-deploy: attempt ${attempt} could not read production — ${error.message}`);
  }

  if (live === expected) {
    console.log(`verify-deploy: production is serving this build (${expected}).`);
    process.exit(0);
  }

  if (attempt < ATTEMPTS) {
    console.log(`verify-deploy: production still on ${live ?? "unknown"}, waiting…`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

console.error(
  [
    "",
    "verify-deploy: the deploy succeeded but production has NOT picked it up yet.",
    `  expected: ${expected}`,
    `  serving:  ${(await liveEntry().catch(() => null)) ?? "unknown"}`,
    "",
    "The edge caches index.html for up to an hour (cache-control: max-age=3600).",
    "The build is live and correct on its own deployment URL right now — use that",
    "to review, or wait for the alias to expire. Nothing needs redeploying.",
    "",
  ].join("\n"),
);
process.exit(1);
